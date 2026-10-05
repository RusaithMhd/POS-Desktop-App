/**
 * Real-time Admin Notification & Alert Service
 * Manages live notification feed, audio chimes, unread badges, and automated DB event detection.
 */

export type NotificationType =
  | 'TRIAL_REGISTERED'
  | 'PAYMENT_PENDING'
  | 'TRIAL_EXPIRING'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'DEVICE_CONNECTED'
  | 'ACCOUNT_SUSPENDED'
  | 'SYSTEM_ALERT';

export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: NotificationPriority;
  metadata?: {
    orgId?: string;
    businessName?: string;
    email?: string;
    trialId?: string;
    planCode?: string;
    daysRemaining?: number;
  };
}

const STORAGE_KEY = 'triwyn_admin_notifications_v1';
const SOUND_ENABLED_KEY = 'triwyn_admin_sound_enabled';

class AdminNotificationServiceImpl {
  private listeners: Array<() => void> = [];
  private knownRegIds: Set<string> = new Set();
  private knownStatusMap: Map<string, string> = new Map();
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initFromStorage();
    }
  }

  private initFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Seed default initial notifications so dashboard feels alive right away
        const initialSeed: AdminNotification[] = [
          {
            id: 'notif-init-1',
            type: 'TRIAL_REGISTERED',
            title: '14-Day Free Trial Registered',
            message: 'A new retail merchant registered for a 14-day evaluation license.',
            timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
            read: false,
            priority: 'MEDIUM',
            metadata: { businessName: 'Rusaith Retail' },
          },
          {
            id: 'notif-init-2',
            type: 'SYSTEM_ALERT',
            title: 'Local Engine Live',
            message: 'Super Admin license monitoring active with 0 latency.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            read: true,
            priority: 'LOW',
          },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSeed));
      }
    } catch {
      // Storage unavailable
    }
  }

  public getNotifications(): AdminNotification[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public getUnreadCount(): number {
    return this.getNotifications().filter((n) => !n.read).length;
  }

  public isSoundEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(SOUND_ENABLED_KEY);
    return val !== 'false';
  }

  public setSoundEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
    this.notifyListeners();
  }

  private toastListeners: Array<(notif: AdminNotification) => void> = [];

  public onToast(callback: (notif: AdminNotification) => void): () => void {
    this.toastListeners.push(callback);
    return () => {
      this.toastListeners = this.toastListeners.filter((l) => l !== callback);
    };
  }

  public deleteNotification(id: string): void {
    const current = this.getNotifications();
    const updated = current.filter((n) => n.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    this.notifyListeners();
  }

  public triggerTestAlert(): AdminNotification {
    return this.addNotification({
      type: 'TRIAL_REGISTERED',
      title: 'New Evaluation Trial Started',
      message: 'Apex Supermarket (Colombo) registered for a 14-day evaluation license.',
      priority: 'HIGH',
      metadata: {
        businessName: 'Apex Supermarket',
        orgId: `org-test-${Math.floor(1000 + Math.random() * 9000)}`,
        email: 'sales@apexsupermarket.lk',
        planCode: 'FREE_TRIAL',
        daysRemaining: 14,
      },
    });
  }

  public addNotification(notif: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>): AdminNotification {
    const newNotif: AdminNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const current = this.getNotifications();
    const updated = [newNotif, ...current].slice(0, 50); // Keep latest 50

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    if (this.isSoundEnabled()) {
      this.playChime(newNotif.priority);
    }

    this.notifyListeners();

    // Trigger realtime toast popup
    this.toastListeners.forEach((fn) => {
      try {
        fn(newNotif);
      } catch (e) {
        console.error('Toast listener error:', e);
      }
    });

    return newNotif;
  }

  public markAsRead(id: string): void {
    const current = this.getNotifications();
    const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    this.notifyListeners();
  }

  public markAllAsRead(): void {
    const current = this.getNotifications();
    const updated = current.map((n) => ({ ...n, read: true }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    this.notifyListeners();
  }

  public clearAll(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch {}
    this.notifyListeners();
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Notification subscriber error:', e);
      }
    });
  }

  /**
   * Compare active database registrations and detect new trials, expirations, and status shifts.
   */
  public scanRegistrations(registrations: any[]): void {
    if (!registrations || !Array.isArray(registrations)) return;

    if (!this.isInitialized) {
      // First run: populate known map without triggering sound storms
      registrations.forEach((r) => {
        this.knownRegIds.add(r.id);
        this.knownStatusMap.set(r.id, r.status);
      });
      this.isInitialized = true;
      return;
    }

    // Check for newly registered merchants
    registrations.forEach((r) => {
      if (!this.knownRegIds.has(r.id)) {
        this.knownRegIds.add(r.id);
        this.knownStatusMap.set(r.id, r.status);

        const isTrial = (r.status || '').toUpperCase() === 'TRIALING' || r.selected_plan_code === 'FREE_TRIAL';
        this.addNotification({
          type: isTrial ? 'TRIAL_REGISTERED' : 'PAYMENT_PENDING',
          title: isTrial ? 'New Free Trial Registered' : 'New Customer Registration',
          message: `${r.business_name} (${r.full_name || r.email}) created an account.`,
          priority: 'HIGH',
          metadata: {
            orgId: r.organization_id,
            businessName: r.business_name,
            email: r.email,
            planCode: r.selected_plan_code,
          },
        });
      } else {
        // Check for status changes
        const oldStatus = this.knownStatusMap.get(r.id);
        const newStatus = r.status;
        if (oldStatus && oldStatus !== newStatus) {
          this.knownStatusMap.set(r.id, newStatus);
          if (newStatus === 'ACTIVE') {
            this.addNotification({
              type: 'SUBSCRIPTION_ACTIVATED',
              title: 'Account Activated',
              message: `${r.business_name} is now ACTIVE with full POS terminal privileges.`,
              priority: 'MEDIUM',
              metadata: { businessName: r.business_name, orgId: r.organization_id },
            });
          } else if (newStatus === 'SUSPENDED') {
            this.addNotification({
              type: 'ACCOUNT_SUSPENDED',
              title: 'Account Suspended',
              message: `${r.business_name} has been suspended by an administrator.`,
              priority: 'HIGH',
              metadata: { businessName: r.business_name, orgId: r.organization_id },
            });
          }
        }
      }

      // Check for impending trial expirations (< 3 days)
      if (r.trial_ends_at && r.status === 'TRIALING') {
        const remainingDays = Math.ceil((new Date(r.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (remainingDays <= 3 && remainingDays >= 0) {
          const alertKey = `exp_alert_${r.id}_${remainingDays}d`;
          if (typeof window !== 'undefined' && !sessionStorage.getItem(alertKey)) {
            sessionStorage.setItem(alertKey, '1');
            this.addNotification({
              type: 'TRIAL_EXPIRING',
              title: 'Trial Expiring Soon',
              message: `${r.business_name}'s trial expires in ${remainingDays === 0 ? 'today' : `${remainingDays} day(s)`}. Follow up for activation.`,
              priority: 'MEDIUM',
              metadata: {
                orgId: r.organization_id,
                businessName: r.business_name,
                daysRemaining: remainingDays,
              },
            });
          }
        }
      }
    });
  }

  /**
   * Synthesize clean, executive chime using native Web Audio API (0 dependencies, 100% offline).
   */
  public playChime(priority: NotificationPriority = 'MEDIUM'): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (priority === 'HIGH') {
        // High alert: 2-tone melodic chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // A5

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.start(now);
        osc.stop(now + 0.36);
      } else {
        // Standard pleasant notify chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

        osc.start(now);
        osc.stop(now + 0.29);
      }
    } catch {
      // Audio context restricted or muted
    }
  }
}

export const AdminNotificationService = new AdminNotificationServiceImpl();
