import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import Modal from 'react-native-modal';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Fingerprint,
  Lock,
  Building2,
  RefreshCw,
  Info,
  LogOut,
  ChevronRight,
  Plus,
  Camera,
  Check,
} from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../lib/store/authStore';
import { authApi } from '../../lib/api/auth.api';
import { apiClient } from '../../lib/api/client';
import { banksApi } from '../../lib/api/banks.api';
import { SmsSync } from '../../components/SmsSync';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/utils/formatDate';

// ── Constants ─────────────────────────────────────────────────────────────────

const LAST_SYNCED_KEY = 'bt_last_synced';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// Pre-configured Indian banks — smsPattern is a regex tested against the sender ID
const PRESET_BANKS = [
  { name: 'HDFC Bank',     shortCode: 'HDFC',  smsPattern: 'HDFCBK',  color: '#004C8F' },
  { name: 'DBS Bank',      shortCode: 'DBS',   smsPattern: 'DBSBNK',  color: '#E60028' },
  { name: 'ICICI Bank',    shortCode: 'ICICI', smsPattern: 'ICICIB',  color: '#F58220' },
  { name: 'SBI',           shortCode: 'SBI',   smsPattern: 'SBIINB|SBIPSG', color: '#0066B3' },
  { name: 'Axis Bank',     shortCode: 'AXIS',  smsPattern: 'AXISBK',  color: '#97144D' },
  { name: 'Kotak Bank',    shortCode: 'KOTAK', smsPattern: 'KOTAKB',  color: '#ED1C24' },
  { name: 'IndusInd Bank', shortCode: 'INDUS', smsPattern: 'INDUSB',  color: '#1B3C8C' },
  { name: 'Yes Bank',      shortCode: 'YES',   smsPattern: 'YESBKS',  color: '#003087' },
  { name: 'Federal Bank',  shortCode: 'FED',   smsPattern: 'FEDBNK',  color: '#003478' },
  { name: 'IDFC First',    shortCode: 'IDFC',  smsPattern: 'IDFCFB',  color: '#6DC2E9' },
  { name: 'Bank of India', shortCode: 'BOI',   smsPattern: 'BOIIND',  color: '#00529B' },
  { name: 'PNB',           shortCode: 'PNB',   smsPattern: 'PNBSMS',  color: '#FF6600' },
  { name: 'Canara Bank',   shortCode: 'CAN',   smsPattern: 'CANBNK',  color: '#005F32' },
  { name: 'Bank of Baroda',shortCode: 'BOB',   smsPattern: 'BOBIFO',  color: '#F47920' },
  { name: 'Union Bank',    shortCode: 'UBI',   smsPattern: 'UBIKOB',  color: '#003087' },
  { name: 'RBL Bank',      shortCode: 'RBL',   smsPattern: 'RBLBNK',  color: '#E31837' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  right,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress || disabled}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>{icon}</View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {right ?? (onPress && <ChevronRight size={16} color="#475569" />)}
    </TouchableOpacity>
  );
}

function Sep() {
  return <View style={styles.sep} />;
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  user,
  onClose,
}: {
  visible: boolean;
  user: { name: string; email: string; image?: string | null } | null;
  onClose: () => void;
}) {
  const [name, setName]     = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const store = useAuthStore();

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ name: name.trim() });
      store.user && useAuthStore.setState({ user: { ...store.user, name: updated.name } });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isVisible={visible} onBackdropPress={onClose} avoidKeyboard style={styles.modal}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>Edit Profile</Text>
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#0A0F1E" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────

function ChangePasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!current || !next || next.length < 8) {
      Alert.alert('Validation', 'New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/api/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      Alert.alert('Done', 'Password changed successfully.');
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to change password. Check your current password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isVisible={visible} onBackdropPress={onClose} avoidKeyboard style={styles.modal}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>Change Password</Text>
        <Input
          label="Current Password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          placeholder="••••••••"
        />
        <Input
          label="New Password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          placeholder="Min. 8 characters"
        />
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#0A0F1E" />
          ) : (
            <Text style={styles.saveBtnText}>Update Password</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Add Bank Modal ────────────────────────────────────────────────────────────

function AddBankModal({
  visible,
  existingShortCodes,
  onClose,
  onAdded,
}: {
  visible: boolean;
  existingShortCodes: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [selected, setSelected] = useState<typeof PRESET_BANKS[0] | null>(null);
  const [saving, setSaving] = useState(false);

  const available = PRESET_BANKS.filter(
    (b) => !existingShortCodes.includes(b.shortCode),
  );

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await banksApi.create(selected);
      onAdded();
      setSelected(null);
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to add bank. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={styles.modal}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>Add Bank</Text>
        <Text style={styles.modalSubtitle}>
          Select your bank. The SMS pattern will be configured automatically.
        </Text>
        <ScrollView
          style={styles.bankList}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {available.map((bank) => {
            const isSelected = selected?.shortCode === bank.shortCode;
            return (
              <TouchableOpacity
                key={bank.shortCode}
                style={[styles.bankRow, isSelected && styles.bankRowSelected]}
                onPress={() => setSelected(isSelected ? null : bank)}
                activeOpacity={0.7}
              >
                <View style={[styles.bankDot, { backgroundColor: bank.color }]} />
                <View style={styles.bankInfo}>
                  <Text style={styles.bankName}>{bank.name}</Text>
                  <Text style={styles.bankCode}>{bank.shortCode}</Text>
                </View>
                {isSelected && <Check size={18} color="#F59E0B" />}
              </TouchableOpacity>
            );
          })}
          {available.length === 0 && (
            <Text style={styles.noBanks}>All supported banks have been added.</Text>
          )}
        </ScrollView>
        <TouchableOpacity
          style={[styles.saveBtn, (!selected || saving) && { opacity: 0.5 }]}
          onPress={handleAdd}
          disabled={!selected || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#0A0F1E" />
          ) : (
            <Text style={styles.saveBtnText}>
              {selected ? `Add ${selected.name}` : 'Select a bank'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, biometricEnabled, logout, enableBiometric, disableBiometric } = useAuthStore();
  const queryClient = useQueryClient();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePass, setShowChangePass]   = useState(false);
  const [showSmsSync, setShowSmsSync]         = useState(false);
  const [showAddBank, setShowAddBank]         = useState(false);
  const [lastSynced, setLastSynced]           = useState<Date | null>(null);
  const [togglingBio, setTogglingBio]         = useState(false);

  // Load last synced timestamp
  const loadLastSynced = useCallback(async () => {
    const raw = await SecureStore.getItemAsync(LAST_SYNCED_KEY);
    if (raw) setLastSynced(new Date(raw));
  }, []);
  useState(() => { loadLastSynced(); });

  // Banks query
  const banksQ = useQuery({
    queryKey: ['banks'],
    queryFn: () => banksApi.list().then((r) => r.data.data),
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    try {
      await authApi.updateProfile({ image: uri });
      if (user) useAuthStore.setState({ user: { ...user, image: uri } });
    } catch {
      Alert.alert('Error', 'Failed to update avatar.');
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    setTogglingBio(true);
    try {
      if (value) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable biometric login',
          cancelLabel: 'Cancel',
        });
        if (result.success) await enableBiometric();
      } else {
        await disableBiometric();
      }
    } finally {
      setTogglingBio(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  };

  const handleSyncComplete = async (ts: Date) => {
    setLastSynced(ts);
    await SecureStore.setItemAsync(LAST_SYNCED_KEY, ts.toISOString());
    setShowSmsSync(false);
  };

  const initials = user?.name ? getInitials(user.name) : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Settings</Text>

        {/* ── Profile ──────────────────────────────────────────────────── */}
        <SectionLabel title="PROFILE" />
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
              <View style={styles.avatarWrap}>
                {user?.image ? (
                  <Image source={{ uri: user.image }} style={styles.avatar} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
                <View style={styles.cameraOverlay}>
                  <Camera size={14} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
              <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setShowEditProfile(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Security ─────────────────────────────────────────────────── */}
        <SectionLabel title="SECURITY" />
        <View style={styles.card}>
          <SettingsRow
            icon={<Fingerprint size={18} color="#F59E0B" />}
            label="Biometric Login"
            right={
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={togglingBio}
                trackColor={{ false: '#1E293B', true: 'rgba(245,158,11,0.4)' }}
                thumbColor={biometricEnabled ? '#F59E0B' : '#475569'}
                ios_backgroundColor="#1E293B"
              />
            }
          />
          <Sep />
          <SettingsRow
            icon={<Lock size={18} color="#94A3B8" />}
            label="Change Password"
            onPress={() => setShowChangePass(true)}
          />
        </View>

        {/* ── Banks ────────────────────────────────────────────────────── */}
        <SectionLabel title="BANKS" />
        <View style={styles.card}>
          {banksQ.isLoading ? (
            <>
              <Skeleton height={48} borderRadius={0} />
              <Sep />
              <Skeleton height={48} borderRadius={0} />
            </>
          ) : (banksQ.data ?? []).length > 0 ? (
            <>
              {(banksQ.data ?? []).map((bank, i) => (
                <View key={bank.id}>
                  {i > 0 && <Sep />}
                  <SettingsRow
                    icon={<Building2 size={18} color="#60A5FA" />}
                    label={bank.name}
                    value={bank.shortCode}
                  />
                </View>
              ))}
              <Sep />
              <SettingsRow
                icon={<Plus size={18} color="#F59E0B" />}
                label="Add Bank"
                onPress={() => setShowAddBank(true)}
              />
            </>
          ) : (
            <SettingsRow
              icon={<Plus size={18} color="#F59E0B" />}
              label="Add Bank"
              onPress={() => setShowAddBank(true)}
            />
          )}
        </View>

        {/* ── Sync ─────────────────────────────────────────────────────── */}
        <SectionLabel title="SYNC" />
        <View style={styles.card}>
          <SettingsRow
            icon={<RefreshCw size={18} color="#34D399" />}
            label="Sync SMS Now"
            value={Platform.OS === 'ios' ? 'Android only' : undefined}
            onPress={Platform.OS === 'android' ? () => setShowSmsSync(true) : undefined}
            disabled={Platform.OS === 'ios'}
          />
          {lastSynced && (
            <>
              <Sep />
              <View style={styles.lastSyncedRow}>
                <Text style={styles.lastSyncedLabel}>Last synced</Text>
                <Text style={styles.lastSyncedValue}>{formatDate(lastSynced.toISOString())}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── About ────────────────────────────────────────────────────── */}
        <SectionLabel title="ABOUT" />
        <View style={styles.card}>
          <SettingsRow
            icon={<Info size={18} color="#94A3B8" />}
            label="App Version"
            value={APP_VERSION}
          />
          <Sep />
          <SettingsRow
            icon={<Shield size={18} color="#94A3B8" />}
            label="Privacy Policy"
            onPress={() => Alert.alert('Privacy Policy', 'Opening Privacy Policy...')}
          />
        </View>

        {/* ── Sign Out ─────────────────────────────────────────────────── */}
        <View style={[styles.card, { marginTop: 4 }]}>
          <SettingsRow
            icon={<LogOut size={18} color="#F87171" />}
            label="Sign Out"
            onPress={handleSignOut}
            danger
          />
        </View>
      </ScrollView>

      <EditProfileModal
        visible={showEditProfile}
        user={user}
        onClose={() => setShowEditProfile(false)}
      />
      <ChangePasswordModal
        visible={showChangePass}
        onClose={() => setShowChangePass(false)}
      />
      <SmsSync
        visible={showSmsSync}
        onClose={() => setShowSmsSync(false)}
        onSyncComplete={handleSyncComplete}
      />
      <AddBankModal
        visible={showAddBank}
        existingShortCodes={(banksQ.data ?? []).map((b) => b.shortCode)}
        onClose={() => setShowAddBank(false)}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ['banks'] })}
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
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },

  screenTitle: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },

  sectionLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    backgroundColor: 'rgba(248,113,113,0.1)',
  },
  rowLabel: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
  },
  rowLabelDanger: {
    color: '#F87171',
  },
  rowValue: {
    color: '#64748B',
    fontSize: 13,
  },
  sep: {
    height: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
  },

  // Profile
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
  },
  avatarInitials: {
    color: '#60A5FA',
    fontSize: 20,
    fontWeight: '700',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
  },
  profileEmail: {
    color: '#64748B',
    fontSize: 12,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  editBtnText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },

  // Last synced
  lastSyncedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lastSyncedLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  lastSyncedValue: {
    color: '#94A3B8',
    fontSize: 13,
  },

  // Modal
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#0A0F1E',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 14,
  },

  // Add Bank Modal
  modalSubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 16,
    marginTop: -12,
  },
  bankList: {
    maxHeight: 360,
    marginBottom: 16,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 12,
    marginBottom: 4,
    backgroundColor: '#1E293B',
  },
  bankRowSelected: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  bankDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
  },
  bankCode: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 1,
  },
  noBanks: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
