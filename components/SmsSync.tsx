import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Modal from 'react-native-modal';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  RefreshCw,
  CircleCheckBig,
  X,
  MessageSquare,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import {
  checkSmsPermission,
  requestSmsPermission,
  readBankSms,
  SmsScanResult,
} from '../lib/hooks/useSmsReader';
import { transactionsApi } from '../lib/api/transactions.api';
import { formatCompact } from '../lib/utils/formatCurrency';
import { formatDate } from '../lib/utils/formatDate';

// ── Constants ─────────────────────────────────────────────────────────────────

const SYNCED_IDS_KEY = 'bt_synced_ids';
type Step = 'permission' | 'scanning' | 'preview' | 'success';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSyncedIds(): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(SYNCED_IDS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

async function saveSyncedIds(ids: Set<string>): Promise<void> {
  // Keep only the last 2000 IDs to prevent unbounded growth
  const arr = Array.from(ids).slice(-2000);
  await SecureStore.setItemAsync(SYNCED_IDS_KEY, JSON.stringify(arr));
}

/** Guess amount and type from the SMS body (best-effort, server re-parses properly). */
function parseSmsPreview(body: string): { amount: number; type: 'credit' | 'debit' } {
  const lower = body.toLowerCase();
  const type = lower.includes('credited') ? 'credit' : 'debit';
  const match = body.match(/(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const amount = match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  return { amount, type };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpinningIcon() {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <RefreshCw size={40} color="#F59E0B" />
    </Animated.View>
  );
}

function SuccessCheckmark() {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 300 }),
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <CircleCheckBig size={64} color="#34D399" />
    </Animated.View>
  );
}

interface PreviewRowProps {
  item: SmsScanResult;
  checked: boolean;
  onToggle: () => void;
}

function PreviewRow({ item, checked, onToggle }: PreviewRowProps) {
  const { amount, type } = parseSmsPreview(item.body);
  const isCredit = type === 'credit';
  return (
    <TouchableOpacity style={styles.previewRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <View style={styles.checkboxInner} />}
      </View>
      <View style={styles.previewDetails}>
        <Text style={styles.previewSender}>{item.sender}</Text>
        <Text style={styles.previewDate}>{formatDate(item.receivedAt.toISOString())}</Text>
      </View>
      {amount > 0 && (
        <Text style={[styles.previewAmount, { color: isCredit ? '#34D399' : '#F87171' }]}>
          {isCredit ? '+' : '−'}{formatCompact(amount)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface SmsSyncProps {
  visible: boolean;
  onClose: () => void;
  onSyncComplete?: (timestamp: Date) => void;
}

export function SmsSync({ visible, onClose, onSyncComplete }: SmsSyncProps) {
  const queryClient = useQueryClient();

  const [step, setStep]                   = useState<Step>('permission');
  const [foundSms, setFoundSms]           = useState<SmsScanResult[]>([]);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [scanCount, setScanCount]         = useState(0);
  const [isSyncing, setIsSyncing]         = useState(false);
  const [successStats, setSuccessStats]   = useState({ count: 0, credits: 0, debits: 0 });
  const hasScanned                        = useRef(false);

  // Reset when modal opens
  useEffect(() => {
    if (!visible) return;
    hasScanned.current = false;
    setStep('permission');
    setFoundSms([]);
    setSelected(new Set());
    setScanCount(0);
    setIsSyncing(false);

    // Auto-advance if permission already granted
    checkSmsPermission().then((status) => {
      if (status === 'granted') startScan();
      else if (status === 'unavailable') setStep('permission'); // shows iOS notice
    });
  }, [visible]);

  // ── Scanning ────────────────────────────────────────────────────────────────

  const startScan = useCallback(async () => {
    if (hasScanned.current) return;
    hasScanned.current = true;
    setStep('scanning');

    const messages = await readBankSms(90);
    if (!messages) {
      // iOS or native module unavailable — can't proceed
      setStep('permission');
      return;
    }

    setScanCount(messages.length);

    // Filter already-synced UIDs
    const syncedIds = await getSyncedIds();
    const fresh = messages.filter((m) => !syncedIds.has(m.uid));

    setFoundSms(fresh);
    setSelected(new Set(fresh.map((m) => m.uid)));
    setStep('preview');
  }, []);

  const handleGrantPermission = async () => {
    const granted = await requestSmsPermission();
    if (granted) startScan();
  };

  // ── Sync ────────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setIsSyncing(true);
    const toSync = foundSms.filter((m) => selected.has(m.uid));

    try {
      const payload = toSync.map((m) => ({
        sender: m.sender,
        body: m.body,
        receivedAt: m.receivedAt.toISOString(),
      }));

      const result = await transactionsApi.batchSms(payload);
      const added = result.data ?? [];

      // Persist synced UIDs
      const syncedIds = await getSyncedIds();
      toSync.forEach((m) => syncedIds.add(m.uid));
      await saveSyncedIds(syncedIds);

      // Compute stats from server-parsed results
      let credits = 0;
      let debits = 0;
      added.forEach((tx: any) => {
        if (tx.type === 'credit') credits += tx.amount ?? 0;
        else debits += tx.amount ?? 0;
      });

      setSuccessStats({ count: added.length, credits, debits });

      // Invalidate queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dailyTrend'] }),
        queryClient.invalidateQueries({ queryKey: ['categoryBreakdown'] }),
        queryClient.invalidateQueries({ queryKey: ['bankBreakdown'] }),
        queryClient.invalidateQueries({ queryKey: ['monthlyTrend'] }),
      ]);

      onSyncComplete?.(new Date());
      setStep('success');
    } catch (e) {
      // Keep on preview — user can retry
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSelected = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  // ── Render steps ─────────────────────────────────────────────────────────────

  const isIOS = Platform.OS === 'ios';

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      avoidKeyboard
      useNativeDriver
    >
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* ── Step: Permission ───────────────────────────────────────────── */}
        {step === 'permission' && (
          <View style={styles.stepWrap}>
            <View style={styles.illustrationWrap}>
              <Shield size={52} color="#F59E0B" />
            </View>
            <Text style={styles.stepTitle}>
              {isIOS ? 'Not Available on iOS' : 'SMS Permission Required'}
            </Text>
            {isIOS ? (
              <Text style={styles.stepDesc}>
                Automatic SMS syncing is only available on Android devices. On iOS, please add
                transactions manually.
              </Text>
            ) : (
              <Text style={styles.stepDesc}>
                BankTracker needs read access to your SMS inbox to detect bank transactions.
                Your messages never leave your device — only the parsed transaction data is
                sent to our servers.
              </Text>
            )}
            {!isIOS && (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleGrantPermission} activeOpacity={0.8}>
                <Text style={styles.primaryBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.ghostBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.ghostBtnText}>{isIOS ? 'Close' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step: Scanning ─────────────────────────────────────────────── */}
        {step === 'scanning' && (
          <View style={styles.stepWrap}>
            <SpinningIcon />
            <Text style={styles.stepTitle}>Scanning SMS…</Text>
            <Text style={styles.stepDesc}>
              {scanCount > 0
                ? `Found ${scanCount} bank messages so far…`
                : 'Searching for bank SMS messages in your inbox…'}
            </Text>
            <ActivityIndicator size="small" color="#F59E0B" style={{ marginTop: 8 }} />
          </View>
        )}

        {/* ── Step: Preview ──────────────────────────────────────────────── */}
        {step === 'preview' && (
          <>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleRow}>
                <MessageSquare size={18} color="#F59E0B" />
                <Text style={styles.stepTitle}>
                  Found {foundSms.length} new transaction{foundSms.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={styles.previewSubtitle}>
                {selected.size} selected · tap to deselect
              </Text>
            </View>

            {foundSms.length === 0 ? (
              <View style={styles.emptyPreview}>
                <Text style={styles.emptyPreviewText}>
                  No new transactions found. All messages have already been synced.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.previewList}
                showsVerticalScrollIndicator={false}
              >
                {foundSms.map((item) => (
                  <PreviewRow
                    key={item.uid}
                    item={item}
                    checked={selected.has(item.uid)}
                    onToggle={() => toggleSelected(item.uid)}
                  />
                ))}
              </ScrollView>
            )}

            <View style={styles.previewFooter}>
              {foundSms.length > 0 ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, (isSyncing || selected.size === 0) && styles.btnDisabled]}
                  onPress={handleSync}
                  disabled={isSyncing || selected.size === 0}
                  activeOpacity={0.8}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color="#0A0F1E" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Sync {selected.size} Transaction{selected.size !== 1 ? 's' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.ghostBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.ghostBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Step: Success ──────────────────────────────────────────────── */}
        {step === 'success' && (
          <View style={styles.stepWrap}>
            <SuccessCheckmark />
            <Text style={styles.stepTitle}>{successStats.count} Transactions Added</Text>
            <View style={styles.successStats}>
              <View style={styles.successStatItem}>
                <TrendingUp size={16} color="#34D399" />
                <Text style={styles.successStatLabel}>Credits</Text>
                <Text style={[styles.successStatValue, { color: '#34D399' }]}>
                  {formatCompact(successStats.credits)}
                </Text>
              </View>
              <View style={styles.successStatDivider} />
              <View style={styles.successStatItem}>
                <TrendingDown size={16} color="#F87171" />
                <Text style={styles.successStatLabel}>Debits</Text>
                <Text style={[styles.successStatValue, { color: '#F87171' }]}>
                  {formatCompact(successStats.debits)}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 24,
  },

  // Steps
  stepWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  illustrationWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    color: '#F1F5F9',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepDesc: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#0A0F1E',
    fontSize: 15,
    fontWeight: '700',
  },
  ghostBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  ghostBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // Preview
  previewHeader: {
    marginBottom: 12,
    gap: 4,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewSubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginLeft: 2,
  },
  previewList: {
    maxHeight: 340,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#0A0F1E',
  },
  previewDetails: {
    flex: 1,
    gap: 2,
  },
  previewSender: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '500',
  },
  previewDate: {
    color: '#475569',
    fontSize: 11,
  },
  previewAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPreview: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyPreviewText: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
  },
  previewFooter: {
    gap: 4,
    marginTop: 12,
  },

  // Success
  successStats: {
    flexDirection: 'row',
    backgroundColor: '#0A0F1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    alignSelf: 'stretch',
    gap: 16,
  },
  successStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  successStatLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  successStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  successStatDivider: {
    width: 1,
    backgroundColor: '#1E293B',
  },
});
