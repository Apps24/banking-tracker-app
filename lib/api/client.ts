import axios from 'axios';
import Toast from 'react-native-toast-message';
import { API_URL } from '../utils/constants';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: read session token from authStore in-memory state.
// Synchronous — no SecureStore hit per request.
// Lazy require breaks the circular dependency (client ↔ authStore).
apiClient.interceptors.request.use((config) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAuthStore } = require('../store/authStore');
  const sessionToken: string | null = useAuthStore.getState().sessionToken;
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return config;
});

// Response interceptor: 401 means the session was revoked or truly expired.
// Better Auth sessions are long-lived (30 days) so a 401 is never "normal".
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAuthStore } = require('../store/authStore');
      // Guard: only act when authenticated to avoid infinite loops on /sign-in
      if (useAuthStore.getState().isAuthenticated) {
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Please log in again.',
          visibilityTime: 4000,
        });
        await useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);
