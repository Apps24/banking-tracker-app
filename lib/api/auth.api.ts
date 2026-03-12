import axios from 'axios';
import { API_URL } from '../utils/constants';
import { User, Session } from '../types';

/**
 * Dedicated axios instance for Better Auth endpoints on the Express backend.
 * No interceptors — avoids circular dependency with apiClient.
 *
 * Base URL: http://<server>/api/auth
 *
 * Better Auth paths (appended to baseURL):
 *   POST /sign-in/email
 *   POST /sign-up/email
 *   POST /sign-out
 *   GET  /session
 */
const authClient = axios.create({
  baseURL: `${API_URL}/api/auth`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export interface SignInResponse {
  token: string;
  user: User;
}

export interface SignUpResponse {
  token: string;
  user: User;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  image?: string;
}

export const authApi = {
  /**
   * POST /api/auth/sign-in/email
   * Authenticates with Better Auth. Returns a 30-day session token.
   */
  signIn: async (email: string, password: string): Promise<SignInResponse> => {
    const { data } = await authClient.post<SignInResponse>('/sign-in/email', {
      email,
      password,
    });
    return data;
  },

  /**
   * POST /api/auth/sign-up/email
   * Registers a new user. Returns a 30-day session token.
   */
  signUp: async (name: string, email: string, password: string): Promise<SignUpResponse> => {
    const { data } = await authClient.post<SignUpResponse>('/sign-up/email', {
      name,
      email,
      password,
    });
    return data;
  },

  /**
   * POST /api/auth/sign-out
   * Revokes the session server-side. Bearer token required.
   * Fire-and-forget — client always clears local state regardless of response.
   */
  signOut: async (token: string): Promise<void> => {
    await authClient.post(
      '/sign-out',
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  },

  /**
   * GET /api/auth/session
   * Validates the stored session token against Better Auth.
   * Used on app start to confirm the stored token is still valid.
   * Throws on 401 — caller should clear stored credentials.
   */
  getSession: async (token: string): Promise<Session> => {
    const { data } = await authClient.get<Session>('/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },

  /**
   * PATCH /api/v1/auth/profile
   * Custom Express route for updating profile fields.
   * Uses apiClient so the auth interceptor attaches the session token.
   */
  updateProfile: async (payload: UpdateProfilePayload): Promise<User> => {
    // Lazy require to avoid circular dependency at module level.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { apiClient } = require('./client') as { apiClient: typeof import('./client').apiClient };
    const { data } = await apiClient.patch<User>('/auth/profile', payload);
    return data;
  },
};
