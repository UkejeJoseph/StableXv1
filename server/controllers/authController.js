import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import redisClient from '../config/redis.js';
import { sendEmail } from '../utils/mailService.js';

// ────────────────────────────────────
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// ────────────────────────────────────
export async function forgotPassword(req, res) {
    console.log('[AUTH-RESET] ══════════════════════════');
    console.log('[AUTH-RESET] Forgot password request');

    try {
        const { email } = req.body;
        console.log('[AUTH-RESET] Email submitted:', email);

        if (!email) {
            console.warn('[AUTH-RESET] ⚠️ No email provided');
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        // Find user - always return success even if not found
        // (prevents email enumeration attacks)
        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        console.log('[AUTH-RESET] User found:', !!user);

        if (user) {
            // Generate secure random token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto
                .createHash('sha256')
                .update(resetToken)
                .digest('hex');

            console.log('[AUTH-RESET] Reset token generated');
            console.log('[AUTH-RESET] Storing in Redis with 15min expiry...');

            // Store hashed token in Redis - 15 minute expiry
            const redisKey = `password_reset:${hashedToken}`;
            await redisClient.setex(redisKey, 900, user._id.toString());

            console.log('[AUTH-RESET] ✅ Token stored in Redis:', redisKey);

            // Build reset URL
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            console.log('[AUTH-RESET] Reset URL built:', resetUrl);

            // Send email via SendGrid
            console.log('[AUTH-RESET] Sending reset email via SendGrid...');

            await sendEmail({
                to: user.email,
                subject: 'Reset Your StableX Password',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>Hi ${user.fullName || 'there'},</p>
            <p>You requested a password reset for your StableX account.</p>
            <p>Click the button below to reset your password. 
               This link expires in <strong>15 minutes</strong>.</p>
            <a href="${resetUrl}" 
               style="background: #6366f1; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
            <p style="margin-top: 20px; color: #666;">
              If you did not request this, please ignore this email.
              Your password will not be changed.
            </p>
            <p style="color: #666;">
              This link will expire at: 
              ${new Date(Date.now() + 900000).toUTCString()}
            </p>
          </div>
        `,
            });

            console.log('[AUTH-RESET] ✅ Reset email sent to:', user.email);
        } else {
            console.log('[AUTH-RESET] User not found - returning success anyway');
        }

        // Always return success to prevent email enumeration
        return res.json({
            success: true,
            message: 'If an account exists with that email, a reset link has been sent.',
        });

    } catch (err) {
        console.error('[AUTH-RESET] ❌ Error:', err.message);
        console.error('[AUTH-RESET] Stack:', err.stack);
        return res.status(500).json({
            success: false,
            error: 'Failed to process password reset request'
        });
    }
}

// ────────────────────────────────────
// RESET PASSWORD
// POST /api/auth/reset-password
// ────────────────────────────────────
export async function resetPassword(req, res) {
    console.log('[AUTH-RESET] ══════════════════════════');
    console.log('[AUTH-RESET] Reset password submission');

    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            console.warn('[AUTH-RESET] ⚠️ Missing token or password');
            return res.status(400).json({
                success: false,
                error: 'Token and new password are required'
            });
        }

        // Validate password strength
        if (newPassword.length < 8) {
            console.warn('[AUTH-RESET] ⚠️ Password too short');
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters'
            });
        }

        // Hash the token to match stored value
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        console.log('[AUTH-RESET] Looking up token in Redis...');

        const redisKey = `password_reset:${hashedToken}`;
        const userId = await redisClient.get(redisKey);

        console.log('[AUTH-RESET] Token found in Redis:', !!userId);

        if (!userId) {
            console.warn('[AUTH-RESET] ⚠️ Token invalid or expired');
            return res.status(400).json({
                success: false,
                error: 'Reset link is invalid or has expired'
            });
        }

        // Find user
        const user = await User.findById(userId);

        if (!user) {
            console.error('[AUTH-RESET] ❌ User not found for ID:', userId);
            return res.status(400).json({
                success: false,
                error: 'User not found'
            });
        }

        console.log('[AUTH-RESET] User found:', user.email);

        // Hash new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        console.log('[AUTH-RESET] New password hashed');

        // Update password in DB
        await User.findByIdAndUpdate(userId, {
            password: hashedPassword,
            passwordChangedAt: new Date(),
        });

        console.log('[AUTH-RESET] ✅ Password updated in DB');

        // Invalidate token immediately
        await redisClient.del(redisKey);
        console.log('[AUTH-RESET] ✅ Token invalidated in Redis');

        // Send confirmation email
        console.log('[AUTH-RESET] Sending confirmation email...');

        await sendEmail({
            to: user.email,
            subject: 'Your StableX Password Has Been Changed',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Changed Successfully</h2>
          <p>Hi ${user.fullName || 'there'},</p>
          <p>Your StableX password was successfully changed at 
             ${new Date().toUTCString()}.</p>
          <p style="color: #dc2626;">
            If you did not make this change, please contact us immediately 
            at support@stablex.com and secure your account.
          </p>
        </div>
      `,
        });

        console.log('[AUTH-RESET] ✅ Confirmation email sent');

        return res.json({
            success: true,
            message: 'Password reset successful. You can now log in.',
        });

    } catch (err) {
        console.error('[AUTH-RESET] ❌ Error:', err.message);
        console.error('[AUTH-RESET] Stack:', err.stack);
        return res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
}
