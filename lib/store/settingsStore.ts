import { create } from 'zustand';

interface SettingsState {
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  currency: string;
  setBiometricEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setCurrency: (currency: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  biometricEnabled: false,
  notificationsEnabled: true,
  currency: 'NGN',
  setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
  setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
  setCurrency: (currency) => set({ currency }),
}));
