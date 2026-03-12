import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { SECURE_KEYS } from '../utils/constants';

interface AuthState {
  // ── In-memory state (fast, cleared on app restart) ──────────────────────
  user: User | null;
  sessionToken: string | null;  // Better Auth long-lived session token
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  loadStoredAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
}

// Internal helper — not on the public interface
async function persistSession(token: string, user: User) {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_KEYS.SESSION_TOKEN, token),
    SecureStore.setItemAsync(SECURE_KEYS.USER_DATA, JSON.stringify(user)),
  ]);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  sessionToken: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,

  // ── loadStoredAuth ────────────────────────────────────────────────────────
  // Called once on app start. Reads SecureStore, validates session with server,
  // then hydrates in-memory state. Sets isLoading = false when done.
  loadStoredAuth: async () => {
    try {
      const [storedToken, storedUser, storedBiometric] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.SESSION_TOKEN),
        SecureStore.getItemAsync(SECURE_KEYS.USER_DATA),
        SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED),
      ]);

      const biometricEnabled = storedBiometric === 'true';

      if (!storedToken) {
        set({ isLoading: false, biometricEnabled });
        return;
      }

      // Validate the stored token with the server before trusting it
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authApi } = require('../api/auth.api');
      const session = await authApi.getSession(storedToken);

      const user: User = session?.user ?? (storedUser ? JSON.parse(storedUser) : null);
      set({ sessionToken: storedToken, user, isAuthenticated: true, isLoading: false, biometricEnabled });
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        // Session truly expired — clear stored credentials
        await Promise.all([
          SecureStore.deleteItemAsync(SECURE_KEYS.SESSION_TOKEN),
          SecureStore.deleteItemAsync(SECURE_KEYS.USER_DATA),
        ]);
      }
      // Network error: don't clear session — allow offline/biometric fallback
      set({ isLoading: false, isAuthenticated: false, sessionToken: null, user: null });
    }
  },

  // ── login ─────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { authApi } = require('../api/auth.api');
    const { token, user } = await authApi.signIn(email, password);
    await persistSession(token, user);
    set({ sessionToken: token, user, isAuthenticated: true });
  },

  // ── register ──────────────────────────────────────────────────────────────
  register: async (name, email, password) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { authApi } = require('../api/auth.api');
    const { token, user } = await authApi.signUp(name, email, password);
    await persistSession(token, user);
    set({ sessionToken: token, user, isAuthenticated: true });
  },

  // ── logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    const currentToken = get().sessionToken;
    // Fire-and-forget — don't block UI waiting for the server response
    if (currentToken) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { authApi } = require('../api/auth.api');
      authApi.signOut(currentToken).catch(() => { /* silent fail */ });
    }
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.SESSION_TOKEN),
      SecureStore.deleteItemAsync(SECURE_KEYS.USER_DATA),
    ]);
    set({ user: null, sessionToken: null, isAuthenticated: false });
  },

  // ── biometric ─────────────────────────────────────────────────────────────
  enableBiometric: async () => {
    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, 'true');
    set({ biometricEnabled: true });
  },

  disableBiometric: async () => {
    await SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
    set({ biometricEnabled: false });
  },
}));
