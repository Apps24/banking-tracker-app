import { useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import Toast from 'react-native-toast-message';
import { useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions.api';
import { checkSmsPermission, BANK_KEYWORDS, querySmsAll } from './useSmsReader';
import { useAuthStore } from '../store/authStore';

const SYNCED_IDS_KEY = 'synced_sms_ids';
const MAX_STORED_IDS = 500;
const BG_TASK_NAME = 'BACKGROUND_SMS_SYNC';

// ── Shared helper ─────────────────────────────────────────────────────────────

export async function processBankSms(
  sender: string,
  body: string,
  timestamp: number,
): Promise<boolean> {
  console.log('[AUTO-SMS] Received SMS', { sender, preview: body.slice(0, 80) });

  if (!body) {
    console.warn('[AUTO-SMS] ❌ Empty body — skipped');
    return false;
  }

  const matchedKw = BANK_KEYWORDS.find((kw) => body.toLowerCase().includes(kw.toLowerCase()));
  if (!matchedKw) {
    console.log('[AUTO-SMS] ⏭  No bank keyword found — not a bank SMS, skipped');
    return false;
  }
  console.log(`[AUTO-SMS] ✅ Keyword matched: "${matchedKw}"`);

  const uid = `${sender}_${timestamp}`;
  const stored = await SecureStore.getItemAsync(SYNCED_IDS_KEY);
  const syncedIds: string[] = stored ? JSON.parse(stored) : [];

  if (syncedIds.includes(uid)) {
    console.log('[AUTO-SMS] ⏭  Already synced (uid in SecureStore) — skipped', uid);
    return false;
  }

  console.log('[AUTO-SMS] Sending to API...', { sender, uid });
  try {
    const result = await transactionsApi.batchSms([
      { sender, body, receivedAt: new Date(timestamp).toISOString() },
    ]);
    const stats = (result.data as any)?.data;
    console.log('[AUTO-SMS] ✅ API response', stats);
    if (stats?.skipped > 0) {
      console.warn('[AUTO-SMS] ⚠️  SMS was skipped by server — check API logs for NO_PATTERN_MATCHED or NO_BANK_MATCHED');
    }
  } catch (e: any) {
    console.error('[AUTO-SMS] ❌ API call failed', {
      message: e?.message,
      status: e?.response?.status,
      data: e?.response?.data,
    });
    return false;
  }

  syncedIds.push(uid);
  await SecureStore.setItemAsync(
    SYNCED_IDS_KEY,
    JSON.stringify(syncedIds.slice(-MAX_STORED_IDS)),
  );
  console.log('[AUTO-SMS] ✅ UID saved to SecureStore', uid);

  return true;
}

// ── Background task (runs every ~15 min even when app is closed) ──────────────

TaskManager.defineTask(BG_TASK_NAME, async () => {
  try {
    if (Platform.OS !== 'android') return BackgroundFetch.BackgroundFetchResult.NoData;

    let SmsAndroid: any;
    try {
      SmsAndroid = require('react-native-get-sms-android');
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    // Read ALL inbox SMS from the last 20 minutes (broad search, no sender filter)
    const minDate = Date.now() - 20 * 60 * 1000;
    const messages = await querySmsAll(SmsAndroid, minDate, 50);

    let newCount = 0;
    for (const sms of messages) {
      try {
        const synced = await processBankSms(
          sms.sender,
          sms.body,
          sms.receivedAt.getTime(),
        );
        if (synced) newCount++;
      } catch {
        // continue with next SMS
      }
    }

    return newCount > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSmsTask() {
  if (Platform.OS !== 'android') return;
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) return;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK_NAME);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BG_TASK_NAME, {
        minimumInterval: 15 * 60, // 15 minutes (Android minimum)
        stopOnTerminate: false,   // keep running after app is closed
        startOnBoot: true,        // restart after device reboot
      });
    }
  } catch {
    // Background fetch not available on this device
  }
}

// ── Foreground hook (instant — fires the moment a bank SMS arrives) ───────────

export function useAutoSmsTracker() {
  const { isAuthenticated } = useAuthStore();
  const qc = useQueryClient();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAuthenticated) return;

    let SmsAndroid: any;
    try {
      SmsAndroid = require('react-native-get-sms-android');
    } catch {
      return;
    }
    if (!SmsAndroid?.startWatch) return;

    let active = true;

    async function startWatch() {
      const status = await checkSmsPermission();
      if (status !== 'granted' || !active) return;

      SmsAndroid.startWatch(
        async (msg: string | Record<string, any>) => {
          const body: string =
            typeof msg === 'string' ? msg : (msg.messageBody ?? msg.body ?? '');
          const sender: string =
            typeof msg === 'object'
              ? (msg.originatingAddress ?? msg.address ?? '')
              : '';
          const timestamp: number =
            typeof msg === 'object' ? (msg.timestamp ?? Date.now()) : Date.now();

          try {
            const synced = await processBankSms(sender, body, timestamp);
            if (synced) {
              qc.invalidateQueries({ queryKey: ['transactions'] });
              qc.invalidateQueries({ queryKey: ['summary'] });
              qc.invalidateQueries({ queryKey: ['dailyTrend'] });
              Toast.show({
                type: 'success',
                text1: 'Transaction detected',
                text2: sender ? `From ${sender}` : 'Bank SMS auto-synced',
                visibilityTime: 3000,
              });
            }
          } catch {
            // Silent — user can manually sync
          }
        },
        () => { /* watch error — ignore */ },
      );
    }

    startWatch();
    // Register background task
    registerBackgroundSmsTask();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        startWatch(); // restart foreground watch
      } else if (next !== 'active') {
        SmsAndroid.stopWatch?.(); // stop foreground watch (background task takes over)
      }
    });

    return () => {
      active = false;
      sub.remove();
      SmsAndroid.stopWatch?.();
    };
  }, [isAuthenticated]);
}
