import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { CartesianChart, Bar, Line, PolarChart, Pie } from 'victory-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  useSummary,
  useCategoryBreakdown,
  useDailyTrend,
  useMonthlyTrend,
  useBankBreakdown,
} from '../../lib/hooks/useAnalytics';
import { formatINR, formatCompact } from '../../lib/utils/formatCurrency';
import { CATEGORY_META } from '../../lib/utils/categories';
import { TransactionCategory } from '../../lib/types';
import { toISODate } from '../../lib/utils/formatDate';

// ── Constants ─────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 40;   // 20px padding each side
const CHART_H = 180;
const DONUT_SIZE = 200;

type RangeKey = '7D' | '30D' | '3M' | '1Y';
const RANGES: RangeKey[] = ['7D', '30D', '3M', '1Y'];

const CATEGORY_COLORS = [
  '#F59E0B', '#34D399', '#60A5FA', '#F87171',
  '#A78BFA', '#FB923C', '#38BDF8',
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getRangeDays(range: RangeKey): number {
  return { '7D': 7, '30D': 30, '3M': 90, '1Y': 365 }[range];
}

function getDates(range: RangeKey) {
  const days = getRangeDays(range);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days + 1);

  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
    prevStartDate: toISODate(prevStart),
    prevEndDate: toISODate(prevEnd),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SummaryCard({
  label,
  value,
  prevValue,
  color,
}: {
  label: string;
  value: number;
  prevValue: number;
  color: string;
}) {
  const pct = prevValue === 0 ? 0 : ((value - prevValue) / prevValue) * 100;
  const up = pct >= 0;
  const Icon = pct === 0 ? Minus : up ? TrendingUp : TrendingDown;
  const trendColor = pct === 0 ? '#64748B' : up ? '#34D399' : '#F87171';

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{formatCompact(value)}</Text>
      <View style={styles.summaryTrend}>
        <Icon size={11} color={trendColor} />
        <Text style={[styles.summaryPct, { color: trendColor }]}>
          {pct === 0 ? '—' : `${Math.abs(pct).toFixed(0)}%`}
        </Text>
      </View>
    </View>
  );
}

function SkeletonCard({ height = 200 }: { height?: number }) {
  return <Skeleton height={height} borderRadius={16} style={styles.skeletonCard} />;
}

// ── Range Tabs ────────────────────────────────────────────────────────────────

function RangeTabs({
  active,
  onChange,
}: {
  active: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  const tabW = (SCREEN_W - 40 - 8) / RANGES.length;  // 20px pad + 4px inner pad each side
  const indicatorX = useSharedValue(RANGES.indexOf(active) * tabW);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const handlePress = (r: RangeKey) => {
    const idx = RANGES.indexOf(r);
    indicatorX.value = withTiming(idx * tabW, { duration: 200, easing: Easing.out(Easing.quad) });
    onChange(r);
  };

  return (
    <View style={styles.tabContainer}>
      <Animated.View style={[styles.tabIndicator, { width: tabW }, indicatorStyle]} />
      {RANGES.map((r) => (
        <TouchableOpacity
          key={r}
          style={[styles.tab, { width: tabW }]}
          onPress={() => handlePress(r)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, active === r && styles.tabLabelActive]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [range, setRange] = useState<RangeKey>('30D');
  const dates = useMemo(() => getDates(range), [range]);

  const summaryQ    = useSummary({ startDate: dates.startDate, endDate: dates.endDate });
  const prevSummaryQ = useSummary({ startDate: dates.prevStartDate, endDate: dates.prevEndDate });
  const categoryQ   = useCategoryBreakdown({ startDate: dates.startDate, endDate: dates.endDate });
  const dailyQ      = useDailyTrend({ startDate: dates.startDate, endDate: dates.endDate });
  const monthlyQ    = useMonthlyTrend(new Date().getFullYear());
  const banksQ      = useBankBreakdown({ startDate: dates.startDate, endDate: dates.endDate });

  const isRefreshing =
    summaryQ.isFetching || categoryQ.isFetching || dailyQ.isFetching;

  const onRefresh = () => {
    summaryQ.refetch();
    prevSummaryQ.refetch();
    categoryQ.refetch();
    dailyQ.refetch();
    monthlyQ.refetch();
    banksQ.refetch();
  };

  // ── Derived chart data ────────────────────────────────────────────────────

  const trendData = useMemo(
    () =>
      (dailyQ.data ?? []).map((d, i) => ({
        x: i,
        credit: d.credit,
        debit: d.debit,
      })),
    [dailyQ.data],
  );

  const pieData = useMemo(() => {
    const items = categoryQ.data ?? [];
    const top6 = items.slice(0, 6);
    const othersTotal = items.slice(6).reduce((s, c) => s + c.amount, 0);
    const result = top6.map((c, i) => ({
      value: c.amount,
      label: CATEGORY_META[c.category as TransactionCategory]?.label ?? c.category,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      category: c.category,
    }));
    if (othersTotal > 0) {
      result.push({ value: othersTotal, label: 'Others', color: '#334155', category: 'other' });
    }
    return result;
  }, [categoryQ.data]);

  const monthlyData = useMemo(
    () =>
      (monthlyQ.data ?? []).map((m, i) => ({
        x: i,
        inflow: m.credit,
        outflow: m.debit,
      })),
    [monthlyQ.data],
  );

  const maxBank = useMemo(() => {
    const items = banksQ.data ?? [];
    return items.reduce((max, b) => Math.max(max, b.total), 0);
  }, [banksQ.data]);

  const summary     = summaryQ.data;
  const prevSummary = prevSummaryQ.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
            colors={['#F59E0B']}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <Text style={styles.screenTitle}>Analytics</Text>

        {/* ── Range Tabs ──────────────────────────────────────────────── */}
        <RangeTabs active={range} onChange={setRange} />

        {/* ── Summary Cards ───────────────────────────────────────────── */}
        {summaryQ.isLoading ? (
          <View style={styles.summaryRow}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={88} borderRadius={14} style={{ flex: 1 }} />
            ))}
          </View>
        ) : summary ? (
          <View style={styles.summaryRow}>
            <SummaryCard
              label="Spent"
              value={summary.totalOutflow}
              prevValue={prevSummary?.totalOutflow ?? 0}
              color="#F87171"
            />
            <SummaryCard
              label="Received"
              value={summary.totalInflow}
              prevValue={prevSummary?.totalInflow ?? 0}
              color="#34D399"
            />
            <SummaryCard
              label="Net"
              value={summary.netBalance}
              prevValue={prevSummary?.netBalance ?? 0}
              color={summary.netBalance >= 0 ? '#34D399' : '#F87171'}
            />
          </View>
        ) : null}

        {/* ── Spending Trend ───────────────────────────────────────────── */}
        <SectionHeader title="Spending Trend" />
        {dailyQ.isLoading ? (
          <SkeletonCard height={CHART_H + 40} />
        ) : trendData.length > 0 ? (
          <View style={styles.chartCard}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#34D399' }]} />
                <Text style={styles.legendLabel}>Credits</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F87171' }]} />
                <Text style={styles.legendLabel}>Debits</Text>
              </View>
            </View>
            <View style={{ height: CHART_H, width: CHART_W - 32 }}>
              <CartesianChart
                data={trendData}
                xKey="x"
                yKeys={['credit', 'debit']}
                domainPadding={{ top: 20, bottom: 0 }}
              >
                {({ points }) => (
                  <>
                    <Line
                      points={points.credit}
                      color="#34D399"
                      strokeWidth={2}
                      curveType="natural"
                    />
                    <Line
                      points={points.debit}
                      color="#F87171"
                      strokeWidth={2}
                      curveType="natural"
                    />
                  </>
                )}
              </CartesianChart>
            </View>
          </View>
        ) : (
          <View style={[styles.chartCard, styles.emptyChart]}>
            <Text style={styles.emptyText}>No data for this period</Text>
          </View>
        )}

        {/* ── Category Breakdown ───────────────────────────────────────── */}
        <SectionHeader title="Category Breakdown" />
        {categoryQ.isLoading ? (
          <SkeletonCard height={DONUT_SIZE + 120} />
        ) : pieData.length > 0 ? (
          <View style={styles.chartCard}>
            <View style={styles.donutRow}>
              <View style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
                <PolarChart
                  data={pieData}
                  labelKey="label"
                  valueKey="value"
                  colorKey="color"
                >
                  <Pie.Chart innerRadius="55%">
                    {({ slice }) => <Pie.Slice />}
                  </Pie.Chart>
                </PolarChart>
              </View>
              <View style={styles.pieLegend}>
                {pieData.map((item) => (
                  <View key={item.label} style={styles.pieLegendItem}>
                    <View style={[styles.pieLegendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.pieLegendLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.pieLegendValue}>
                      {formatCompact(item.value)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.chartCard, styles.emptyChart]}>
            <Text style={styles.emptyText}>No category data</Text>
          </View>
        )}

        {/* ── Bank Breakdown ───────────────────────────────────────────── */}
        <SectionHeader title="Bank Breakdown" />
        {banksQ.isLoading ? (
          <SkeletonCard height={140} />
        ) : (banksQ.data ?? []).length > 0 ? (
          <View style={styles.chartCard}>
            {(banksQ.data ?? []).map((bank) => {
              const pct = maxBank > 0 ? (bank.total / maxBank) * 100 : 0;
              return (
                <View key={bank.bank} style={styles.bankRow}>
                  <View style={styles.bankTop}>
                    <Text style={styles.bankName}>{bank.bank}</Text>
                    <Text style={styles.bankAmount}>{formatCompact(bank.total)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.bankCount}>{bank.count} transactions</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.chartCard, styles.emptyChart]}>
            <Text style={styles.emptyText}>No bank data</Text>
          </View>
        )}

        {/* ── Monthly Comparison ───────────────────────────────────────── */}
        <SectionHeader title="Monthly Comparison" />
        {monthlyQ.isLoading ? (
          <SkeletonCard height={CHART_H + 40} />
        ) : monthlyData.length > 0 ? (
          <View style={styles.chartCard}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#34D399' }]} />
                <Text style={styles.legendLabel}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F87171' }]} />
                <Text style={styles.legendLabel}>Spending</Text>
              </View>
            </View>
            <View style={{ height: CHART_H, width: CHART_W - 32 }}>
              <CartesianChart
                data={monthlyData}
                xKey="x"
                yKeys={['inflow', 'outflow']}
                domainPadding={{ left: 8, right: 8, top: 20, bottom: 0 }}
              >
                {({ points, chartBounds }) => (
                  <>
                    <Bar
                      points={points.inflow}
                      chartBounds={chartBounds}
                      color="#34D399"
                      innerPadding={0.3}
                      barCount={2}
                    />
                    <Bar
                      points={points.outflow}
                      chartBounds={chartBounds}
                      color="#F87171"
                      innerPadding={0.3}
                      barCount={2}
                    />
                  </>
                )}
              </CartesianChart>
            </View>
            <View style={styles.monthLabels}>
              {monthlyData.slice(-6).map((_, i, arr) => {
                const fullIdx = monthlyData.length - 6 + i;
                const raw = monthlyQ.data?.[fullIdx];
                return (
                  <Text key={fullIdx} style={styles.monthLabel}>
                    {raw?.monthName ? raw.monthName.slice(0, 3) : ''}
                  </Text>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={[styles.chartCard, styles.emptyChart]}>
            <Text style={styles.emptyText}>No monthly data</Text>
          </View>
        )}
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
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },

  screenTitle: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },

  // Range tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    backgroundColor: '#1E293B',
    borderRadius: 9,
  },
  tab: {
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  tabLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#F59E0B',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  summaryPct: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Section header
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // Chart card
  chartCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  skeletonCard: {
    marginBottom: 0,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#64748B',
    fontSize: 12,
  },

  // Donut
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pieLegend: {
    flex: 1,
    gap: 8,
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  pieLegendLabel: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
  },
  pieLegendValue: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },

  // Bank breakdown
  bankRow: {
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  bankTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
  },
  bankAmount: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  bankCount: {
    color: '#475569',
    fontSize: 11,
  },

  // Monthly labels
  monthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  monthLabel: {
    color: '#475569',
    fontSize: 10,
  },
});
