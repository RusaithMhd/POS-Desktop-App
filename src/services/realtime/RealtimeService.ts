import { useEffect } from 'react';

export type RealtimeEventType =
  | 'SALE_CREATED'
  | 'INVENTORY_UPDATED'
  | 'PRINT_JOB_QUEUED'
  | 'PRINT_JOB_UPDATED'
  | 'ACTIVE_USERS_UPDATED'
  | 'CONNECTION_STATUS_CHANGED';

export interface RealtimeEventPayload<T = any> {
  type: RealtimeEventType;
  senderDeviceId: string;
  senderUserId: string;
  timestamp: string;
  data: T;
}

type EventCallback<T = any> = (event: RealtimeEventPayload<T>) => void;

class RealtimeService {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<RealtimeEventType, Set<EventCallback>> = new Map();
  private deviceId: string = 'POS-' + Math.floor(100 + Math.random() * 900);
  private connectionStatus: 'ONLINE' | 'RECONNECTING' | 'OFFLINE' = 'ONLINE';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('triwyn_pos_realtime_events');
        this.channel.onmessage = (msgEvent) => {
          if (msgEvent.data && msgEvent.data.type) {
            this.notifyListeners(msgEvent.data as RealtimeEventPayload);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported in current environment', err);
      }

      window.addEventListener('online', () => this.setConnectionStatus('ONLINE'));
      window.addEventListener('offline', () => this.setConnectionStatus('OFFLINE'));
    }
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getConnectionStatus(): 'ONLINE' | 'RECONNECTING' | 'OFFLINE' {
    return this.connectionStatus;
  }

  public setConnectionStatus(status: 'ONLINE' | 'RECONNECTING' | 'OFFLINE') {
    this.connectionStatus = status;
    this.emit('CONNECTION_STATUS_CHANGED', { status });
  }

  public emit<T = any>(type: RealtimeEventType, data: T, userId: string = 'system') {
    const payload: RealtimeEventPayload<T> = {
      type,
      senderDeviceId: this.deviceId,
      senderUserId: userId,
      timestamp: new Date().toISOString(),
      data,
    };

    // 1. Notify local in-memory subscribers
    this.notifyListeners(payload);

    // 2. Broadcast across tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {
        console.error('Failed to post broadcast message', err);
      }
    }
  }

  public subscribe<T = any>(type: RealtimeEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type)!;
    set.add(callback as EventCallback);

    return () => {
      set.delete(callback as EventCallback);
    };
  }

  private notifyListeners(payload: RealtimeEventPayload) {
    const callbacks = this.listeners.get(payload.type);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('Error in realtime listener callback', err);
        }
      });
    }
  }
}

export const realtimeService = new RealtimeService();

export function useRealtimeEvent<T = any>(eventType: RealtimeEventType, callback: EventCallback<T>) {
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe<T>(eventType, callback);
    return () => {
      unsubscribe();
    };
  }, [eventType, callback]);
}
