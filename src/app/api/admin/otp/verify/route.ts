import { NextResponse } from 'next/server';
import { AdminOtpManager } from '@/lib/adminOtpStore';

const AUTHORIZED_SUPER_ADMIN_EMAIL = (process.env.MASTER_ADMIN_EMAIL || 'rusa.rock72@gmail.com').toLowerCase().trim();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'Email and 6-digit OTP code are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    if (cleanEmail !== AUTHORIZED_SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Access Denied: Unauthorized administrator email.' },
        { status: 403 }
      );
    }

    const verification = AdminOtpManager.verifyOtp(cleanEmail, otp);

    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid verification code.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verification successful.',
    });
  } catch (err: any) {
    console.error('Failed to verify OTP:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error during verification.' },
      { status: 500 }
    );
  }
}
