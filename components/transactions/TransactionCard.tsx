import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Transaction } from '../../lib/types';
import { CATEGORY_META } from '../../lib/utils/categories';
import { formatTransactionAmount, formatCompact } from '../../lib/utils/formatCurrency';
import { formatRelative } from '../../lib/utils/formatDate';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: () => void;
}

export function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const router = useRouter();
  const meta = CATEGORY_META[transaction.category] ?? CATEGORY_META['OTHER'];
  const { Icon, bg, color } = meta;

  const isCredit = transaction.type === 'CREDIT';
  const amountColor = isCredit ? '#34D399' : '#F87171';
  const amountStr = formatTransactionAmount(transaction.amount, transaction.type);

  const displayName = transaction.merchant || transaction.description;
  const lastFour = transaction.account?.accountNumber?.slice(-4);
  const bankName = transaction.bank?.name ?? '';
  const bankLabel = lastFour ? `${bankName} ···· ${lastFour}` : bankName;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/transaction/${transaction.id}`);
    }
  };

  return (
    <Pressable
      style={styles.card}
      onPress={handlePress}
      android_ripple={{ color: '#1E293B' }}
    >
      <View style={[styles.iconCircle, { backgroundColor: bg }]}>
        <Icon size={18} color={color} />
      </View>

      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatRelative(transaction.smsDate)} · {bankLabel}
        </Text>
      </View>

      <View style={styles.amountCol}>
        <Text style={[styles.amount, { color: amountColor }]}>{amountStr}</Text>
        {transaction.balance != null && (
          <Text style={styles.balance}>Bal {formatCompact(transaction.balance)}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  details: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
  },
  meta: {
    color: '#64748B',
    fontSize: 12,
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
  },
  balance: {
    color: '#475569',
    fontSize: 11,
  },
});
