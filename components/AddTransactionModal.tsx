import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Modal from 'react-native-modal';
import { useQueryClient } from '@tanstack/react-query';
import { PenLine, TrendingUp, TrendingDown } from 'lucide-react-native';
import { Input } from './ui/Input';
import { banksApi } from '../lib/api/banks.api';
import { transactionsApi } from '../lib/api/transactions.api';
import { ALL_CATEGORIES, CATEGORY_META } from '../lib/utils/categories';
import { TransactionCategory } from '../lib/types';
import { useQuery } from '@tanstack/react-query';

// ── Types ─────────────────────────────────────────────────────────────────────

const MODES = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'CARD', 'ATM', 'EMI', 'OTHER'] as const;
type Mode = typeof MODES[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeToggle({
  value,
  onChange,
}: {
  value: 'DEBIT' | 'CREDIT';
  onChange: (v: 'DEBIT' | 'CREDIT') => void;
}) {
  return (
    <View style={s.typeRow}>
      {(['DEBIT', 'CREDIT'] as const).map((t) => {
        const active = value === t;
        const isCredit = t === 'CREDIT';
        return (
          <TouchableOpacity
            key={t}
            style={[s.typeBtn, active && (isCredit ? s.typeBtnCredit : s.typeBtnDebit)]}
            onPress={() => onChange(t)}
            activeOpacity={0.75}
          >
            {isCredit
              ? <TrendingUp size={15} color={active ? '#34D399' : '#475569'} />
              : <TrendingDown size={15} color={active ? '#F87171' : '#475569'} />}
            <Text style={[s.typeBtnText, active && { color: isCredit ? '#34D399' : '#F87171' }]}>
              {isCredit ? 'Credit' : 'Debit'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={s.sectionLabel}>{title}</Text>;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ visible, onClose }: Props) {
  const queryClient = useQueryClient();

  const [type, setType]           = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [amount, setAmount]       = useState('');
  const [bankId, setBankId]       = useState('');
  const [date, setDate]           = useState(todayISO);
  const [description, setDesc]    = useState('');
  const [merchant, setMerchant]   = useState('');
  const [category, setCategory]   = useState<TransactionCategory>('OTHER');
  const [mode, setMode]           = useState<Mode>('UPI');
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const banksQ = useQuery({
    queryKey: ['banks'],
    queryFn: () => banksApi.list().then((r) => r.data.data),
  });
  const banks = banksQ.data ?? [];

  // Auto-select first bank when loaded
  if (banks.length > 0 && !bankId) setBankId(banks[0].id);

  const validate = () => {
    const e: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount';
    if (!bankId) e.bankId = 'Select a bank';
    if (!isValidDate(date)) e.date = 'Use format YYYY-MM-DD';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setSaving(true);
    try {
      await transactionsApi.create({
        type,
        amount: parseFloat(amount),
        bankId,
        date,
        description: description.trim() || undefined,
        merchant:    merchant.trim()    || undefined,
        category,
        transactionMode: mode,
      } as any);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['dailyTrend'] }),
        queryClient.invalidateQueries({ queryKey: ['categoryBreakdown'] }),
        queryClient.invalidateQueries({ queryKey: ['bankBreakdown'] }),
        queryClient.invalidateQueries({ queryKey: ['monthlyTrend'] }),
      ]);

      // Reset
      setType('DEBIT'); setAmount(''); setDate(todayISO());
      setDesc(''); setMerchant(''); setCategory('OTHER'); setMode('UPI');
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save transaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={s.modal}
      avoidKeyboard
      useNativeDriver
    >
      <View style={s.sheet}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <PenLine size={18} color="#F59E0B" />
          </View>
          <Text style={s.title}>Add Transaction</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* Type */}
          <TypeToggle value={type} onChange={setType} />

          {/* Amount */}
          <Input
            label="Amount (₹)"
            value={amount}
            onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: '' })); }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={errors.amount}
          />

          {/* Bank */}
          <SectionLabel title="BANK" />
          <View style={s.chipGroup}>
            {banksQ.isLoading
              ? <ActivityIndicator color="#F59E0B" />
              : banks.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[s.chip, bankId === b.id && s.chipActive]}
                    onPress={() => { setBankId(b.id); setErrors((e) => ({ ...e, bankId: '' })); }}
                    activeOpacity={0.7}
                  >
                    <View style={[s.bankDot, { backgroundColor: b.color }]} />
                    <Text style={[s.chipText, bankId === b.id && s.chipTextActive]}>
                      {b.shortCode}
                    </Text>
                  </TouchableOpacity>
                ))
            }
          </View>
          {errors.bankId ? <Text style={s.errorText}>{errors.bankId}</Text> : null}

          {/* Date */}
          <Input
            label="Date"
            value={date}
            onChangeText={(v) => { setDate(v); setErrors((e) => ({ ...e, date: '' })); }}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
            error={errors.date}
          />

          {/* Merchant / Description */}
          {type === 'DEBIT'
            ? <Input label="Merchant (optional)" value={merchant} onChangeText={setMerchant} placeholder="Amazon, Zomato…" />
            : <Input label="Received From (optional)" value={merchant} onChangeText={setMerchant} placeholder="Name or UPI ID" />
          }
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDesc}
            placeholder="Add a note…"
          />

          {/* Category */}
          <SectionLabel title="CATEGORY" />
          <View style={s.chipGroup}>
            {ALL_CATEGORIES.map((cat) => {
              const { Icon, bg, color, label } = CATEGORY_META[cat];
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[s.catChip, active && s.catChipActive]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                >
                  <View style={[s.catIcon, { backgroundColor: bg }]}>
                    <Icon size={13} color={color} />
                  </View>
                  <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Mode */}
          <SectionLabel title="PAYMENT MODE" />
          <View style={s.chipGroup}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.chip, mode === m && s.chipActive]}
                onPress={() => setMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, mode === m && s.chipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#0A0F1E" />
            : <Text style={s.saveBtnText}>Save Transaction</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  modal:  { justifyContent: 'flex-end', margin: 0 },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '92%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center', marginBottom: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  headerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#F1F5F9', fontSize: 17, fontWeight: '700' },

  // Type toggle
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 12,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  typeBtnDebit:  { backgroundColor: 'rgba(248,113,113,0.1)',  borderColor: 'rgba(248,113,113,0.4)'  },
  typeBtnCredit: { backgroundColor: 'rgba(52,211,153,0.1)',   borderColor: 'rgba(52,211,153,0.4)'   },
  typeBtnText:   { color: '#475569', fontSize: 14, fontWeight: '600' },

  // Section label
  sectionLabel: {
    color: '#475569', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 4,
  },

  // Generic chips
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
  },
  chipActive:    { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#F59E0B' },
  chipText:      { color: '#64748B', fontSize: 12, fontWeight: '500' },
  chipTextActive:{ color: '#F59E0B' },

  // Bank dot
  bankDot: { width: 8, height: 8, borderRadius: 4 },

  // Category chips
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: '#334155',
  },
  catChipActive: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#F59E0B' },
  catIcon: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  // Error
  errorText: { color: '#F87171', fontSize: 12, marginTop: -10, marginBottom: 12 },

  // Buttons
  saveBtn: {
    backgroundColor: '#F59E0B', paddingVertical: 15,
    borderRadius: 14, alignItems: 'center', marginTop: 12,
  },
  saveBtnText:   { color: '#0A0F1E', fontSize: 15, fontWeight: '700' },
  cancelBtn:     { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontSize: 14 },
});
