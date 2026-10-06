// In-memory OTP Store for Master Super Admin Two-Factor Authentication

interface OtpRecord {
  code: string;
  expiresAt: number; // Unix timestamp ms
  attempts: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __triwyn_admin_otp_store__: Map<string, OtpRecord> | undefined;
}

const store: Map<string, OtpRecord> = globalThis.__triwyn_admin_otp_store__ || new Map();
if (!globalThis.__triwyn_admin_otp_store__) {
  globalThis.__triwyn_admin_otp_store__ = store;
}

export class AdminOtpManager {
  static createOtp(email: string): string {
    const cleanEmail = email.toLowerCase().trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    store.set(cleanEmail, {
      code,
      expiresAt,
      attempts: 0,
    });

    return code;
  }

  static verifyOtp(email: string, code: string): { valid: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    const record = store.get(cleanEmail);

    if (!record) {
      return { valid: false, error: 'No active OTP verification code found. Please request a new code.' };
    }

    if (Date.now() > record.expiresAt) {
      store.delete(cleanEmail);
      return { valid: false, error: 'Verification code has expired. Please request a new code.' };
    }

    if (record.attempts >= 5) {
      store.delete(cleanEmail);
      return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };
    }

    if (record.code !== code.trim()) {
      record.attempts += 1;
      return { valid: false, error: `Invalid code. ${5 - record.attempts} attempt(s) remaining.` };
    }

    // Success: consume OTP
    store.delete(cleanEmail);
    return { valid: true };
  }

  static getActiveCode(email: string): string | null {
    const record = store.get(email.toLowerCase().trim());
    if (record && Date.now() <= record.expiresAt) {
      return record.code;
    }
    return null;
  }
}
