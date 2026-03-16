import { Platform } from 'react-native';
import { PermissionsAndroid } from 'react-native';

// ── Bank sender IDs ───────────────────────────────────────────────────────────
// Indian bank SMS gateway sender IDs (VM- = verified message, AM- = alert message)
export const BANK_SENDER_IDS = [
  // DBS
  'VM-DBSBNK', 'JM-DBSBNK',
  // HDFC Bank
  'VM-HDFCBK', 'AM-HDFCBK', 'VK-HDFCBK', 'JX-HDFCBK', 'JM-HDFCBK', 'AD-HDFCBK', 'VD-HDFCBK', 'AX-HDFCBK',
  // SBI
  'VM-SBIINB', 'AM-SBIINB', 'VM-SBIPSG', 'AM-SBIPSG',
  // ICICI Bank
  'VM-ICICIB', 'AM-ICICIB', 'VK-ICICIB', 'AD-ICICIT',
  // Axis Bank
  'VM-AXISBK', 'AM-AXISBK', 'VK-AXISBK',
  // Kotak Bank
  'VM-KOTAKB', 'AM-KOTAKB',
  // Bank of India
  'VM-BOIIND', 'AM-BOIIND',
  // PNB
  'VM-PNBSMS', 'AM-PNBSMS',
  // Canara Bank
  'VM-CANBNK', 'AM-CANBNK',
  // Bank of Baroda
  'VM-BOBIFO', 'AM-BOBIFO',
  // Union Bank
  'VM-UBIKOB', 'AM-UBIKOB',
  // IndusInd
  'VM-INDUSB', 'AM-INDUSB',
  // Yes Bank
  'VM-YESBKS', 'AM-YESBKS',
  // Federal Bank
  'VM-FEDBNK', 'AM-FEDBNK',
  // IDFC First
  'VM-IDFCFB', 'AM-IDFCFB',
  // RBL Bank
  'VM-RBLBNK', 'AM-RBLBNK',
];

// Keywords that indicate a transactional SMS
export const BANK_KEYWORDS = ['debited', 'credited', 'Rs.', 'INR', 'debit', 'credit'];

export interface SmsScanResult {
  sender: string;
  body: string;
  receivedAt: Date;
  /** Unique stable ID for deduplication: "{sender}_{date}" */
  uid: string;
}

export type SmsPermissionStatus = 'granted' | 'denied' | 'unavailable';

// ── Permission helpers ────────────────────────────────────────────────────────

export async function checkSmsPermission(): Promise<SmsPermissionStatus> {
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const read = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    );
    return read ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.READ_SMS] ===
      PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

// ── SMS reader ────────────────────────────────────────────────────────────────

/**
 * Reads ALL inbox SMS from the last `daysBack` days and filters by
 * transaction keywords (debited, credited, Rs., INR, etc.).
 *
 * Uses a broad search (no sender filter) so it reliably finds bank SMS
 * regardless of the exact sender ID format used by the carrier.
 *
 * Returns null on iOS (unsupported) or if the native module is unavailable.
 */
export async function readBankSms(
  daysBack = 90,
): Promise<SmsScanResult[] | null> {
  if (Platform.OS !== 'android') return null;

  let SmsAndroid: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SmsAndroid = require('react-native-get-sms-android');
  } catch {
    return null;
  }

  if (!SmsAndroid) return null;

  const minDate = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const results = await querySmsAll(SmsAndroid, minDate);

  // Sort newest first
  results.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  return results;
}

/**
 * Reads all inbox SMS (no sender filter) from minDate onward,
 * then filters by BANK_KEYWORDS on the JS side.
 */
export function querySmsAll(
  SmsAndroid: any,
  minDate: number,
  maxCount = 500,
): Promise<SmsScanResult[]> {
  return new Promise((resolve) => {
    SmsAndroid.list(
      JSON.stringify({ box: 'inbox', minDate, maxCount }),
      (_fail: string) => resolve([]),
      (_count: number, smsList: string) => {
        try {
          const arr: any[] = JSON.parse(smsList);
          const filtered = arr
            .filter((sms) => {
              const body: string = sms.body ?? '';
              return BANK_KEYWORDS.some((kw) =>
                body.toLowerCase().includes(kw.toLowerCase()),
              );
            })
            .map((sms) => {
              const date = sms.date ? new Date(Number(sms.date)) : new Date();
              return {
                sender: sms.address ?? '',
                body: sms.body ?? '',
                receivedAt: date,
                uid: `${sms.address ?? 'unknown'}_${sms.date ?? Date.now()}`,
              };
            });
          resolve(filtered);
        } catch {
          resolve([]);
        }
      },
    );
  });
}
