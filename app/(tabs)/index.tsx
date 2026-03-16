import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
} from 'lucide-react-native';
import { format, subDays, startOfMonth } from 'date-fns';
import { useAuthStore } from '../../lib/store/authStore';
import { useSummary, useDailyData } from '../../lib/hooks/useAnalytics';
import { useTransactions } from '../../lib/hooks/useTransactions';
import { TransactionCard } from '../../components/transactions/TransactionCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import { formatINR, formatCompact } from '../../lib/utils/formatCurrency';
import { toISODate } from '../../lib/utils/formatDate';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Week bar chart (pure RN Views — no Skia required) ────────────────────────

interface DayBar {
  day: string;
  credit: number;
  debit: number;
}

function WeekBarChart({ data, loading }: { data: DayBar[]; loading: boolean }) {
  if (loading) {
    return (
      <View style={chartStyles.container}>
        <Skeleton height={90} borderRadius={8} />
      </View>
    );
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.credit, d.debit]), 1);
  const BAR_MAX_H = 72;

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.barsRow}>
        {data.map((d, i) => (
          <View key={i} style={chartStyles.barGroup}>
            <View style={chartStyles.barPair}>
              {/* Credit bar — grows upward */}
              <View style={[chartStyles.barSlot, { height: BAR_MAX_H }]}>
                <View
                  style={[
                    chartStyles.bar,
                    {
                      height: d.credit > 0 ? Math.max((d.credit / maxVal) * BAR_MAX_H, 4) : 0,
                      backgroundColor: '#34D399',
                    },
                  ]}
                />
              </View>
              {/* Debit bar — grows upward */}
              <View style={[chartStyles.barSlot, { height: BAR_MAX_H }]}>
                <View
                  style={[
                    chartStyles.bar,
                    {
                      height: d.debit > 0 ? Math.max((d.debit / maxVal) * BAR_MAX_H, 4) : 0,
                      backgroundColor: '#F87171',
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={chartStyles.dayLabel}>{d.day}</Text>
          </View>
        ))}
      </View>

      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#34D399' }]} />
          <Text style={chartStyles.legendText}>Credits</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#F87171' }]} />
          <Text style={chartStyles.legendText}>Debits</Text>
        </View>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barPair: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
  },
  barSlot: {
    width: 10,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 10,
    borderRadius: 3,
  },
  dayLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#64748B',
    fontSize: 11,
  },
});

// ── Stat mini-card ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColor,
  loading,
}: {
  label: string;
  value: string;
  valueColor: string;
  loading: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      {loading ? (
        <Skeleton height={20} width={64} borderRadius={6} style={{ marginTop: 4 }} />
      ) : (
        <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      )}
    </View>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);

  // Date range — current month up to today
  const today = new Date();
  const startDate = toISODate(startOfMonth(today));
  const endDate = toISODate(today);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useSummary({ startDate, endDate });

  const {
    data: txResponse,
    isLoading: txLoading,
    refetch: refetchTx,
  } = useTransactions({ page: 1, limit: 5 });

  const {
    data: dailyData,
    isLoading: dailyLoading,
    refetch: refetchDaily,
  } = useDailyData(year, month);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchTx(), refetchDaily()]);
    setRefreshing(false);
  }, [refetchSummary, refetchTx, refetchDaily]);

  // ── Last 7 days chart data ───────────────────────────────────────────────
  const chartData: DayBar[] = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    const iso = toISODate(d);
    const found = dailyData?.find((x:any) => x.date === iso);
    return {
      day: format(d, 'EEE'),
      credit: found?.credit ?? 0,
      debit: found?.debit ?? 0,
    };
  });

  // ── Derived stats ────────────────────────────────────────────────────────
  const netBalance = summary?.netBalance ?? 0;
  const totalInflow = summary?.totalInflow ?? 0;
  const totalOutflow = summary?.totalOutflow ?? 0;
  const txCount = summary?.transactionCount ?? 0;
  const avgTx = txCount > 0 ? (totalInflow + totalOutflow) / txCount : 0;

  const transactions = (txResponse as any)?.data ?? [];
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
            colors={['#F59E0B']}
          />
        }
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
            <Bell size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ── Balance Card ──────────────────────────────────────────────── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Net This Month</Text>
          {summaryLoading ? (
            <>
              <Skeleton height={40} width={200} borderRadius={8} style={{ marginVertical: 8 }} />
              <Skeleton height={18} width={240} borderRadius={6} />
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.balanceAmount,
                  { color: netBalance >= 0 ? '#34D399' : '#F87171' },
                ]}
              >
                {formatINR(netBalance)}
              </Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <ArrowUpRight size={14} color="#34D399" />
                  <Text style={styles.balanceItemLabel}>Credits</Text>
                  <Text style={[styles.balanceItemValue, { color: '#34D399' }]}>
                    {formatCompact(totalInflow)}
                  </Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceItem}>
                  <ArrowDownLeft size={14} color="#F87171" />
                  <Text style={styles.balanceItemLabel}>Debits</Text>
                  <Text style={[styles.balanceItemValue, { color: '#F87171' }]}>
                    {formatCompact(totalOutflow)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Month Stats ───────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            label="Net Savings"
            value={formatCompact(netBalance)}
            valueColor={netBalance >= 0 ? '#34D399' : '#F87171'}
            loading={summaryLoading}
          />
          <StatCard
            label="Transactions"
            value={String(txCount)}
            valueColor="#F59E0B"
            loading={summaryLoading}
          />
          <StatCard
            label="Avg Transaction"
            value={formatCompact(avgTx)}
            valueColor="#94A3B8"
            loading={summaryLoading}
          />
        </View>

        {/* ── Last 7 Days Chart ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Last 7 Days</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/analytics')}
              activeOpacity={0.7}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>View Analytics</Text>
              <ChevronRight size={14} color="#F59E0B" />
            </TouchableOpacity>
          </View>
          <View style={styles.chartCard}>
            <WeekBarChart data={chartData} loading={dailyLoading} />
          </View>
        </View>

        {/* ── Recent Transactions ───────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/transactions')}
              activeOpacity={0.7}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>View All</Text>
              <ChevronRight size={14} color="#F59E0B" />
            </TouchableOpacity>
          </View>

          <View style={styles.txList}>
            {txLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={styles.txSkeleton}>
                  <Skeleton width={42} height={42} borderRadius={12} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton height={14} width="65%" borderRadius={6} />
                    <Skeleton height={11} width="45%" borderRadius={4} />
                  </View>
                  <Skeleton height={14} width={56} borderRadius={6} />
                </View>
              ))
            ) : transactions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>Sync your SMS to get started</Text>
              </View>
            ) : (
              transactions.map((tx: any) => (
                <TransactionCard key={tx.id} transaction={tx} />
              ))
            )}
          </View>
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          <View style={{ flex: 1 }}>
            <Button
              title="Sync SMS"
              variant="primary"
              size="md"
              fullWidth
              onPress={() => {}}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Add Manual"
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => {}}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    color: '#64748B',
    fontSize: 14,
  },
  name: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Balance card
  balanceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  balanceLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  balanceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  balanceItemLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  balanceItemValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  balanceDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#1E293B',
    marginHorizontal: 12,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 4,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Sections
  section: {
    gap: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '600',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '500',
  },

  // Chart card
  chartCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },

  // Transaction list
  txList: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 16,
  },
  txSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#475569',
    fontSize: 12,
  },

  // Quick actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
