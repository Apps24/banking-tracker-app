import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Modal from 'react-native-modal';
import { ChevronDown, ChevronUp, Check, Trash2 } from 'lucide-react-native';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  useTransaction,
  useDeleteTransaction,
  useUpdateTransactionCategory,
} from '../../lib/hooks/useTransactions';
import { TransactionCategory } from '../../lib/types';
import { formatINR } from '../../lib/utils/formatCurrency';
import { formatDate, formatTime } from '../../lib/utils/formatDate';
import { CATEGORY_META, ALL_CATEGORIES } from '../../lib/utils/categories';

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: 'credit' | 'debit' }) {
  const isCredit = type === 'credit';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isCredit ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)' },
      ]}
    >
      <Text style={[styles.badgeText, { color: isCredit ? '#34D399' : '#F87171' }]}>
        {isCredit ? 'CREDIT' : 'DEBIT'}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
  onPress,
  mono,
}: {
  label: string;
  value: string;
  valueColor?: string;
  onPress?: () => void;
  mono?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.rowValue,
            mono && styles.rowValueMono,
            valueColor ? { color: valueColor } : undefined,
          ]}
          numberOfLines={2}
        >
          {value}
        </Text>
        {onPress && (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>Edit</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function CategoryPickerModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: TransactionCategory;
  onSelect: (cat: TransactionCategory) => void;
  onClose: () => void;
}) {
  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={modal.bottomSheet}>
      <View style={modal.sheet}>
        <View style={modal.handle} />
        <Text style={modal.title}>Change Category</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={modal.grid}>
            {ALL_CATEGORIES.map((cat) => {
              const { Icon, bg, color, label } = CATEGORY_META[cat];
              const isSelected = cat === current;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[modal.catChip, isSelected && modal.catChipActive]}
                  onPress={() => { onSelect(cat); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={[modal.catIcon, { backgroundColor: bg }]}>
                    <Icon size={16} color={color} />
                  </View>
                  <Text style={[modal.catLabel, isSelected && modal.catLabelActive]}>
                    {label}
                  </Text>
                  {isSelected && (
                    <Check size={14} color="#F59E0B" style={{ marginLeft: 'auto' as any }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Detail Screen ─────────────────────────────────────────────────────────────

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const txId    = Array.isArray(id) ? id[0] : (id ?? '');

  const { data: tx, isLoading } = useTransaction(txId);
  const deleteMutation           = useDeleteTransaction();
  const updateCategory           = useUpdateTransactionCategory();

  const [showSms,       setShowSms]       = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'This transaction will be permanently removed and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMutation.mutateAsync(txId);
            router.back();
          },
        },
      ]
    );
  };

  const handleCategoryChange = (cat: TransactionCategory) => {
    updateCategory.mutate({ id: txId, category: cat });
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading || !tx) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={headerOptions} />
        <View style={styles.loadingContainer}>
          <Skeleton height={60} width={180} borderRadius={12} style={{ marginBottom: 12 }} />
          <Skeleton height={28} width={80} borderRadius={20} style={{ marginBottom: 32 }} />
          <Skeleton height={220} borderRadius={16} style={{ marginBottom: 16 }} />
          <Skeleton height={100} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  const isCredit = tx.type === 'credit';
  const amountColor = isCredit ? '#34D399' : '#F87171';
  const { Icon, bg, color, label: catLabel } = CATEGORY_META[tx.category];
  const lastFour = tx.accountNumber?.slice(-4);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={headerOptions} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: bg }]}>
            <Icon size={32} color={color} />
          </View>
          <Text style={[styles.heroAmount, { color: amountColor }]}>
            {isCredit ? '+' : '−'}{formatINR(tx.amount)}
          </Text>
          <TypeBadge type={tx.type} />
        </View>

        {/* ── Details ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <DetailRow label="Description" value={tx.merchant || tx.description} />
          <View style={styles.sep} />
          <DetailRow
            label="Category"
            value={catLabel}
            onPress={() => setShowCatPicker(true)}
          />
          <View style={styles.sep} />
          <DetailRow label="Bank" value={tx.bank} />
          {lastFour && (
            <>
              <View style={styles.sep} />
              <DetailRow label="Account" value={`···· ${lastFour}`} mono />
            </>
          )}
          {tx.balance != null && (
            <>
              <View style={styles.sep} />
              <DetailRow
                label="Balance After"
                value={formatINR(tx.balance)}
                valueColor="#94A3B8"
              />
            </>
          )}
          <View style={styles.sep} />
          <DetailRow label="Date" value={formatDate(tx.date)} />
          <View style={styles.sep} />
          <DetailRow label="Time" value={formatTime(tx.date)} />
          {tx.reference && (
            <>
              <View style={styles.sep} />
              <DetailRow label="Reference" value={tx.reference} mono />
            </>
          )}
        </View>

        {/* ── Original SMS ─────────────────────────────────────────────── */}
        {tx.rawSms && (
          <View style={styles.smsSection}>
            <TouchableOpacity
              style={styles.smsToggle}
              onPress={() => setShowSms((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.smsToggleLabel}>Original SMS</Text>
              {showSms
                ? <ChevronUp size={18} color="#64748B" />
                : <ChevronDown size={18} color="#64748B" />
              }
            </TouchableOpacity>
            {showSms && (
              <View style={styles.smsBody}>
                <Text style={styles.smsText}>{tx.rawSms}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Delete ───────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.deleteBtn, deleteMutation.isPending && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
          activeOpacity={0.8}
        >
          {deleteMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Trash2 size={18} color="#fff" />
              <Text style={styles.deleteBtnText}>Delete Transaction</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <CategoryPickerModal
        visible={showCatPicker}
        current={tx.category}
        onSelect={handleCategoryChange}
        onClose={() => setShowCatPicker(false)}
      />
    </SafeAreaView>
  );
}

const headerOptions = {
  title: 'Transaction',
  headerShown: true,
  headerStyle:         { backgroundColor: '#0F172A' },
  headerTintColor:     '#F59E0B',
  headerTitleStyle:    { color: '#F1F5F9', fontSize: 16, fontWeight: '600' as const },
  headerShadowVisible: false,
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },
  loadingContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    paddingTop: 32,
  },
  scroll: { flex: 1 },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Card
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  rowRight: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  rowValue: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  rowValueMono: {
    letterSpacing: 0.5,
  },
  editBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    flexShrink: 0,
  },
  editBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  sep: {
    height: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
  },

  // SMS
  smsSection: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  smsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  smsToggleLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  smsBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  smsText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 12,
  },

  // Delete
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E11D48',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

// ── Modal styles ──────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  bottomSheet: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  grid: {
    gap: 8,
    paddingBottom: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0A0F1E',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  catChipActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  catLabelActive: {
    color: '#F59E0B',
  },
});
