import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Swipeable } from 'react-native-gesture-handler';
import Modal from 'react-native-modal';
import { format, isToday, isYesterday, startOfWeek, startOfMonth, subDays, parseISO } from 'date-fns';
import {
  Search,
  X,
  ChevronDown,
  Trash2,
  Receipt,
  SlidersHorizontal,
  Check,
} from 'lucide-react-native';
import { TransactionCard } from '../../components/transactions/TransactionCard';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useInfiniteTransactions, useDeleteTransaction } from '../../lib/hooks/useTransactions';
import { Transaction, TransactionCategory } from '../../lib/types';
import { formatCompact } from '../../lib/utils/formatCurrency';
import { toISODate } from '../../lib/utils/formatDate';
import { CATEGORY_META, ALL_CATEGORIES } from '../../lib/utils/categories';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'credit' | 'debit';
type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

interface Filters {
  type: FilterType;
  categories: TransactionCategory[];
  startDate?: string;
  endDate?: string;
  sort: SortOption;
}

type ListItem =
  | { type: 'header'; dateKey: string; label: string; credit: number; debit: number }
  | { type: 'tx'; tx: Transaction };

// ── Constants ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_desc',   label: 'Newest First'    },
  { value: 'date_asc',    label: 'Oldest First'    },
  { value: 'amount_desc', label: 'Highest Amount'  },
  { value: 'amount_asc',  label: 'Lowest Amount'   },
];

function quickDates() {
  const today = new Date();
  return [
    { label: 'Today',       start: toISODate(today),                 end: toISODate(today) },
    { label: 'This Week',   start: toISODate(startOfWeek(today)),    end: toISODate(today) },
    { label: 'This Month',  start: toISODate(startOfMonth(today)),   end: toISODate(today) },
    { label: 'Last 30 Days',start: toISODate(subDays(today, 30)),    end: toISODate(today) },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (d.getFullYear() === new Date().getFullYear()) return format(d, 'MMMM d');
  return format(d, 'MMMM d, yyyy');
}

function buildFlatList(txs: Transaction[]): { items: ListItem[]; headerIndices: number[] } {
  const items: ListItem[] = [];
  const headerIndices: number[] = [];
  const groups = new Map<string, Transaction[]>();

  for (const tx of txs) {
    const key = toISODate(tx.smsDate);
    const g = groups.get(key);
    if (g) g.push(tx);
    else groups.set(key, [tx]);
  }

  for (const [dateKey, dayTxs] of groups) {
    headerIndices.push(items.length);
    const credit = dayTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
    const debit  = dayTxs.filter(t => t.type === 'DEBIT' ).reduce((s, t) => s + t.amount, 0);
    items.push({ type: 'header', dateKey, label: getDateLabel(dateKey), credit, debit });
    for (const tx of dayTxs) items.push({ type: 'tx', tx });
  }

  return { items, headerIndices };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DateHeader({
  label,
  credit,
  debit,
}: {
  label: string;
  credit: number;
  debit: number;
}) {
  return (
    <View style={styles.dateHeader}>
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateTotals}>
        {credit > 0 && (
          <Text style={styles.dateCredit}>+{formatCompact(credit)}</Text>
        )}
        {debit > 0 && (
          <Text style={styles.dateDebit}>−{formatCompact(debit)}</Text>
        )}
      </View>
    </View>
  );
}

function SwipeableRow({
  tx,
  onDelete,
}: {
  tx: Transaction;
  onDelete: () => void;
}) {
  const renderRightActions = () => (
    <TouchableOpacity style={styles.deleteAction} onPress={onDelete} activeOpacity={0.8}>
      <Trash2 size={20} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <TransactionCard transaction={tx} />
    </Swipeable>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function DateModal({
  visible,
  startDate,
  endDate,
  onApply,
  onClose,
}: {
  visible: boolean;
  startDate?: string;
  endDate?: string;
  onApply: (start?: string, end?: string) => void;
  onClose: () => void;
}) {
  const [localStart, setLocalStart] = useState(startDate ?? '');
  const [localEnd,   setLocalEnd]   = useState(endDate   ?? '');

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={modalStyles.bottomSheet}
      avoidKeyboard
    >
      <View style={modalStyles.sheet}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>Date Range</Text>

        {/* Quick picks */}
        {quickDates().map((q) => (
          <TouchableOpacity
            key={q.label}
            style={[
              modalStyles.option,
              startDate === q.start && endDate === q.end && modalStyles.optionActive,
            ]}
            onPress={() => { onApply(q.start, q.end); onClose(); }}
            activeOpacity={0.7}
          >
            <Text style={[
              modalStyles.optionText,
              startDate === q.start && endDate === q.end && modalStyles.optionTextActive,
            ]}>
              {q.label}
            </Text>
            {startDate === q.start && endDate === q.end && (
              <Check size={16} color="#F59E0B" />
            )}
          </TouchableOpacity>
        ))}

        <View style={modalStyles.divider} />
        <Text style={modalStyles.sectionLabel}>Custom Range</Text>

        <TextInput
          style={modalStyles.dateInput}
          placeholder="Start date (YYYY-MM-DD)"
          placeholderTextColor="#475569"
          value={localStart}
          onChangeText={setLocalStart}
          keyboardType="numeric"
        />
        <TextInput
          style={modalStyles.dateInput}
          placeholder="End date (YYYY-MM-DD)"
          placeholderTextColor="#475569"
          value={localEnd}
          onChangeText={setLocalEnd}
          keyboardType="numeric"
        />

        <View style={modalStyles.row}>
          <TouchableOpacity
            style={[modalStyles.btn, modalStyles.btnGhost]}
            onPress={() => { onApply(undefined, undefined); onClose(); }}
          >
            <Text style={modalStyles.btnGhostText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.btn, modalStyles.btnPrimary]}
            onPress={() => {
              onApply(localStart || undefined, localEnd || undefined);
              onClose();
            }}
          >
            <Text style={modalStyles.btnPrimaryText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CategoryModal({
  visible,
  selected,
  onApply,
  onClose,
}: {
  visible: boolean;
  selected: TransactionCategory[];
  onApply: (cats: TransactionCategory[]) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<TransactionCategory[]>(selected);

  const toggle = (cat: TransactionCategory) => {
    setLocal((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={modalStyles.bottomSheet}>
      <View style={modalStyles.sheet}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>Filter by Category</Text>

        <View style={modalStyles.catGrid}>
          {ALL_CATEGORIES.map((cat) => {
            const { Icon, bg, color, label } = CATEGORY_META[cat];
            const isSelected = local.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[modalStyles.catChip, isSelected && modalStyles.catChipActive]}
                onPress={() => toggle(cat)}
                activeOpacity={0.7}
              >
                <View style={[modalStyles.catIcon, { backgroundColor: bg }]}>
                  <Icon size={16} color={color} />
                </View>
                <Text style={[modalStyles.catLabel, isSelected && modalStyles.catLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={modalStyles.row}>
          <TouchableOpacity
            style={[modalStyles.btn, modalStyles.btnGhost]}
            onPress={() => { setLocal([]); onApply([]); onClose(); }}
          >
            <Text style={modalStyles.btnGhostText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.btn, modalStyles.btnPrimary]}
            onPress={() => { onApply(local); onClose(); }}
          >
            <Text style={modalStyles.btnPrimaryText}>
              Apply{local.length > 0 ? ` (${local.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SortModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: SortOption;
  onSelect: (s: SortOption) => void;
  onClose: () => void;
}) {
  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={modalStyles.bottomSheet}>
      <View style={modalStyles.sheet}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>Sort By</Text>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[modalStyles.option, current === opt.value && modalStyles.optionActive]}
            onPress={() => { onSelect(opt.value); onClose(); }}
            activeOpacity={0.7}
          >
            <Text style={[
              modalStyles.optionText,
              current === opt.value && modalStyles.optionTextActive,
            ]}>
              {opt.label}
            </Text>
            {current === opt.value && <Check size={16} color="#F59E0B" />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TransactionsScreen() {
  const router = useRouter();
  const deleteMutation = useDeleteTransaction();

  const [searchText, setSearchText]       = useState('');
  const [debouncedSearch, setDebounced]   = useState('');
  const [filters, setFilters] = useState<Filters>({
    type: 'all',
    categories: [],
    sort: 'date_desc',
  });
  const [showDateModal,     setShowDateModal]     = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSortModal,     setShowSortModal]     = useState(false);

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  // ── Query params derived from filter state ─────────────────────────────────
  const queryParams = useMemo(() => ({
    type:       filters.type !== 'all' ? (filters.type.toUpperCase() as 'CREDIT' | 'DEBIT') : undefined,
    startDate:  filters.startDate,
    endDate:    filters.endDate,
    search:     debouncedSearch || undefined,
    categories: filters.categories.length > 0 ? filters.categories.join(',') : undefined,
    sort:       filters.sort !== 'date_desc' ? filters.sort : undefined,
  }), [filters, debouncedSearch]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteTransactions(queryParams);

  // ── Flatten + client-side sort/filter ─────────────────────────────────────
  const allTxs = useMemo(() => {
    let txs = data?.pages.flatMap((p) => p.data) ?? [];
    // Client-side category post-filter (for multi-select when server only pre-filters)
    if (filters.categories.length > 0) {
      txs = txs.filter((t) => filters.categories.includes(t.category));
    }
    // Client-side amount sorting
    if (filters.sort === 'amount_desc') txs = [...txs].sort((a, b) => b.amount - a.amount);
    if (filters.sort === 'amount_asc')  txs = [...txs].sort((a, b) => a.amount - b.amount);
    return txs;
  }, [data, filters.categories, filters.sort]);

  const { items, headerIndices } = useMemo(() => buildFlatList(allTxs), [allTxs]);

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const totalCredit = useMemo(
    () => allTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0),
    [allTxs]
  );
  const totalDebit = useMemo(
    () => allTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0),
    [allTxs]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  }, [deleteMutation]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Active filter indicators ───────────────────────────────────────────────
  const dateActive     = !!(filters.startDate || filters.endDate);
  const catActive      = filters.categories.length > 0;
  const sortActive     = filters.sort !== 'date_desc';

  const dateChipLabel = dateActive
    ? `${filters.startDate} → ${filters.endDate}`
    : 'Date ▾';
  const catChipLabel = catActive
    ? `${filters.categories.length} categor${filters.categories.length > 1 ? 'ies' : 'y'} ▾`
    : 'Category ▾';
  const sortChipLabel = SORT_OPTIONS.find(o => o.value === filters.sort)?.label + ' ▾';

  // ── Render item ────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <DateHeader
          label={item.label}
          credit={item.credit}
          debit={item.debit}
        />
      );
    }
    return (
      <SwipeableRow
        tx={item.tx}
        onDelete={() => handleDelete(item.tx.id)}
      />
    );
  }, [handleDelete]);

  const keyExtractor = useCallback((item: ListItem) =>
    item.type === 'header' ? `hdr-${item.dateKey}` : `tx-${item.tx.id}`,
    []
  );

  // ── Loading skeletons ──────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <View style={styles.skeletonList}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={42} height={42} borderRadius={12} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton height={14} width="60%" borderRadius={6} />
            <Skeleton height={11} width="40%" borderRadius={4} />
          </View>
          <Skeleton height={14} width={52} borderRadius={6} />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor="#475569"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter chips ────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        <FilterChip
          label="All"
          active={filters.type === 'all'}
          onPress={() => setFilters((f) => ({ ...f, type: 'all' }))}
        />
        <FilterChip
          label="Credits"
          active={filters.type === 'credit'}
          onPress={() => setFilters((f) => ({ ...f, type: 'credit' }))}
        />
        <FilterChip
          label="Debits"
          active={filters.type === 'debit'}
          onPress={() => setFilters((f) => ({ ...f, type: 'debit' }))}
        />
        <View style={styles.chipSeparator} />
        <FilterChip label={dateChipLabel}  active={dateActive} onPress={() => setShowDateModal(true)} />
        <FilterChip label={catChipLabel}   active={catActive}  onPress={() => setShowCategoryModal(true)} />
        <FilterChip label={sortChipLabel}  active={sortActive} onPress={() => setShowSortModal(true)} />
      </ScrollView>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {allTxs.length} transaction{allTxs.length !== 1 ? 's' : ''}
          {'  ·  '}
          <Text style={styles.statsCredit}>↑ {formatCompact(totalCredit)}</Text>
          {'  ·  '}
          <Text style={styles.statsDebit}>↓ {formatCompact(totalDebit)}</Text>
        </Text>
      </View>

      {/* ── List ────────────────────────────────────────────────────────── */}
      {isLoading ? renderSkeleton() : (
        <View style={styles.listContainer}>
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={(item) => item.type}
            stickyHeaderIndices={headerIndices}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon={<Receipt size={28} color="#64748B" />}
                title="No transactions found"
                description={
                  debouncedSearch || catActive || dateActive
                    ? 'Try adjusting your filters or search.'
                    : 'Sync your SMS messages to get started.'
                }
                actionLabel={debouncedSearch || catActive || dateActive ? 'Clear Filters' : undefined}
                onAction={() => {
                  setSearchText('');
                  setFilters({ type: 'all', categories: [], sort: 'date_desc' });
                }}
              />
            }
            ListFooterComponent={
              isFetchingNextPage
                ? <ActivityIndicator color="#F59E0B" style={styles.footerSpinner} />
                : null
            }
          />
        </View>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <DateModal
        visible={showDateModal}
        startDate={filters.startDate}
        endDate={filters.endDate}
        onApply={(start, end) => setFilters((f) => ({ ...f, startDate: start, endDate: end }))}
        onClose={() => setShowDateModal(false)}
      />
      <CategoryModal
        visible={showCategoryModal}
        selected={filters.categories}
        onApply={(cats) => setFilters((f) => ({ ...f, categories: cats }))}
        onClose={() => setShowCategoryModal(false)}
      />
      <SortModal
        visible={showSortModal}
        current={filters.sort}
        onSelect={(s) => setFilters((f) => ({ ...f, sort: s }))}
        onClose={() => setShowSortModal(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },

  // Search
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 14,
  },

  // Filter chips
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  chipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
  },
  chipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#F59E0B',
  },
  chipSeparator: {
    width: 1,
    height: 20,
    backgroundColor: '#1E293B',
    marginHorizontal: 2,
  },

  // Stats bar
  statsBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  statsText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  statsCredit: {
    color: '#34D399',
  },
  statsDebit: {
    color: '#F87171',
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // Date header
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0A0F1E',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  dateLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  dateTotals: {
    flexDirection: 'row',
    gap: 10,
  },
  dateCredit: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '500',
  },
  dateDebit: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '500',
  },

  // Swipe delete
  deleteAction: {
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginVertical: 2,
    gap: 4,
  },
  deleteText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Skeleton
  skeletonList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },

  footerSpinner: {
    paddingVertical: 20,
  },
});

// ── Modal styles ──────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  bottomSheet: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1E293B',
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
  sectionLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
  },
  optionText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#F59E0B',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 12,
  },
  dateInput: {
    backgroundColor: '#0A0F1E',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#F59E0B',
  },
  btnPrimaryText: {
    color: '#0A0F1E',
    fontSize: 15,
    fontWeight: '600',
  },
  btnGhost: {
    backgroundColor: '#1E293B',
  },
  btnGhostText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500',
  },

  // Category grid
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0A0F1E',
    borderWidth: 1,
    borderColor: '#1E293B',
    width: '47%',
  },
  catChipActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  catIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  catLabelActive: {
    color: '#F59E0B',
  },
});
