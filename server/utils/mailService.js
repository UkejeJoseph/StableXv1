import nodemailer from 'nodemailer';

// Initialize Nodemailer transporter with Gmail SMTP and App Password
// The transporter is created lazily when sending an email to ensure 
// environment variables have been fully injected by dotenv first.
let transporter;

const getTransporter = () => {
  if (!transporter) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      throw new Error('MAIL_USER or MAIL_PASS is missing in environment variables');
    }

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });
  }
  return transporter;
};

export const sendOtpEmail = async (email, otp) => {
  try {
    const mailTransporter = getTransporter();

    const mailOptions = {
      from: `"StableX Security" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'StableX Verification Code',
      text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4F46E5;">StableX Verification</h2>
          <p>You requested a verification code for your StableX account.</p>
          <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; border-radius: 5px;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This code will expire in 10 minutes. If you did not request this, please ignore this email.
          </p>
        </div>
      `
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`✉️ OTP Email sent via Gmail TO: [${email}] FROM: [${process.env.MAIL_USER}]. Message ID: ${info.messageId}`);
    return info;

  } catch (error) {
    console.error("Mail Service Error:", error.message);
    throw error;
  }
};
