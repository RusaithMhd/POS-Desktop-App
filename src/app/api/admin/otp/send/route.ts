import { NextResponse } from 'next/server';
import { sendOtpEmail } from '@/lib/mailer';
import { AdminOtpManager } from '@/lib/adminOtpStore';

const AUTHORIZED_SUPER_ADMIN_EMAIL = (process.env.MASTER_ADMIN_EMAIL || 'rusa.rock72@gmail.com').toLowerCase().trim();
const AUTHORIZED_SUPER_ADMIN_PASSWORD = process.env.MASTER_ADMIN_PASSWORD || 'Rusaith@7253@Mim!72';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Strict security check: ONLY rusa.rock72@gmail.com is permitted
    if (cleanEmail !== AUTHORIZED_SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Access Denied: Only the authorized Master Super Administrator can access this console.' },
        { status: 403 }
      );
    }

    // Verify master password
    if (password !== AUTHORIZED_SUPER_ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Invalid master credentials.' },
        { status: 401 }
      );
    }

    // Generate 6-digit OTP
    const otp = AdminOtpManager.createOtp(cleanEmail);

    // Send email via Gmail SMTP
    const emailResult = await sendOtpEmail(cleanEmail, otp);

    return NextResponse.json({
      success: true,
      message: emailResult.sent
        ? `Security OTP sent to ${cleanEmail}. Please check your inbox.`
        : `Security OTP generated. ${emailResult.error || ''}`,
      sent: emailResult.sent,
      isSimulated: emailResult.isSimulated || false,
      // Provide fallback OTP if SMTP is not configured yet so the user is never locked out during setup
      fallbackOtp: emailResult.isSimulated || !emailResult.sent ? otp : undefined,
    });
  } catch (err: any) {
    console.error('Failed to dispatch OTP:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while dispatching security OTP.' },
      { status: 500 }
    );
  }
}
