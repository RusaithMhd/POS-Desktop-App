import nodemailer from 'nodemailer';

export interface SendOtpEmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  isSimulated?: boolean;
}

export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<SendOtpEmailResult> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || 'rusa.rock72@gmail.com';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || `"TRIWYN Master Security" <${user}>`;

  // If no password configured yet, log to console and simulate cleanly
  if (!pass || pass.trim() === '') {
    console.warn(`[GMAIL SMTP OTP]: SMTP_PASS is not configured in .env. Security Code for ${toEmail} is: ${otpCode}`);
    return {
      sent: false,
      isSimulated: true,
      error: 'Gmail App Password not yet configured in .env. Security code displayed in console/UI for setup.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 24px; color: #f8fafc; }
          .container { max-width: 540px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 36px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .badge { display: inline-block; padding: 6px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 999px; color: #fbbf24; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px; }
          h1 { font-size: 24px; font-weight: 800; margin: 0 0 10px; color: #ffffff; }
          p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px; }
          .code-box { background: #020617; border: 2px dashed #f59e0b; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0; }
          .code { font-family: 'Courier New', monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #f59e0b; margin: 0; }
          .meta { font-size: 12px; color: #64748b; margin-top: 8px; }
          .footer { border-top: 1px solid #1e293b; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
          .highlight { color: #f8fafc; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Master Super Admin Security</div>
          <h1>Security Verification Code</h1>
          <p>You are attempting to access the <span class="highlight">TRIWYN POS Master Super Admin Console</span>.</p>
          <p>Please enter the single-use 6-digit security code below to complete authorization:</p>
          
          <div class="code-box">
            <div class="code">${otpCode}</div>
            <div class="meta">Valid for 10 minutes • Do not share this code</div>
          </div>

          <p style="font-size: 13px;">If you did not initiate this login attempt, please secure your master email and change your security password immediately.</p>
          
          <div class="footer">
            TRIWYN POS Platform • Commercial Hardware & Licensing Security<br/>
            Authorized Destination: ${toEmail}
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: `🛡️ ${otpCode} is your TRIWYN Super Admin Verification Code`,
      text: `Your TRIWYN Master Super Admin OTP verification code is: ${otpCode}. Valid for 10 minutes.`,
      html: htmlContent,
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    console.error('[GMAIL SMTP Send Error]:', err);
    return {
      sent: false,
      error: err.message || 'Failed to send OTP email via Gmail SMTP.',
    };
  }
}
