import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const testEmail = async () => {
    try {
        await sgMail.send({
            to: 'esther.ukeje@gmail.com',
            from: {
                email: process.env.SENDGRID_FROM_EMAIL,
                name: 'StableX'
            },
            subject: 'StableX Email Test',
            html: `
        <h2>StableX Email Test</h2>
        <p>If you received this email the 
        SendGrid integration is working.</p>
        <p>Your OTP would appear here in 
        production.</p>
      `
        });
        console.log('✅ Email sent successfully to esther.ukeje@gmail.com');
    } catch (err) {
        console.error('❌ Email failed:', err.message);
        if (err.response) {
            console.error('SendGrid error:', err.response.body);
        }
    }
};

testEmail();
