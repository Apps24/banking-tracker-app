import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';
import { authApi, UpdateProfilePayload } from '../api/auth.api';
import { SECURE_KEYS } from '../utils/constants';

export type BiometryType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricAvailability {
  available: boolean;
  biometryType: BiometryType;
  enrolled: boolean;
}

export function useAuth() {
  const {
    user,
    sessionToken,
    isAuthenticated,
    isLoading,
    biometricEnabled,
    login,
    register,
    logout,
    enableBiometric,
    disableBiometric,
    loadStoredAuth,
  } = useAuthStore();

  // ── Biometric availability check ────────────────────────────────────────
  const checkBiometricAvailability = async (): Promise<BiometricAvailability> => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return { available: false, biometryType: 'none', enrolled: false };
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometryType: BiometryType = 'none';
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometryType = 'facial';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometryType = 'fingerprint';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometryType = 'iris';
    }

    return { available: compatible, biometryType, enrolled };
  };

  // ── Biometric login ──────────────────────────────────────────────────────
  // Flow: authenticate biometric → read stored session token from SecureStore
  //       → validate with server → set in memory state
  const loginWithBiometric = async (): Promise<boolean> => {
    const { available, enrolled } = await checkBiometricAvailability();
    if (!available || !enrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Log in to BankTracker',
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (!result.success) return false;

    // Biometric passed — validate stored session with server
    const storedToken = await SecureStore.getItemAsync(SECURE_KEYS.SESSION_TOKEN);
    if (!storedToken) return false;

    try {
      const session = await authApi.getSession(storedToken);
      if (session?.user) {
        useAuthStore.setState({
          sessionToken: storedToken,
          user: session.user,
          isAuthenticated: true,
        });
        return true;
      }
    } catch {
      // Session invalid — caller should redirect to full login screen
    }

    return false;
  };

  // ── Profile update ───────────────────────────────────────────────────────
  const updateProfile = async (payload: UpdateProfilePayload) => {
    const updatedUser = await authApi.updateProfile(payload);
    useAuthStore.setState({ user: updatedUser });
    await SecureStore.setItemAsync(SECURE_KEYS.USER_DATA, JSON.stringify(updatedUser));
    return updatedUser;
  };

  return {
    user,
    sessionToken,
    isAuthenticated,
    isLoading,
    biometricEnabled,
    login,
    register,
    logout,
    loadStoredAuth,
    enableBiometric,
    disableBiometric,
    loginWithBiometric,
    checkBiometricAvailability,
    updateProfile,
  };
}
