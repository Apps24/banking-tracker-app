import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../lib/store/authStore';
import { OfflineBanner } from '../components/common/OfflineBanner';
import '../global.css';

// Prevent the native splash from auto-hiding before assets are ready
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 2 * 60 * 1000,   // 2 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// ── AppState refresh ──────────────────────────────────────────────────────────
// Invalidates stale transaction and analytics data when the app foregrounds.
function AppStateRefresh() {
  const qc = useQueryClient();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const handleChange = useCallback(
    (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        qc.invalidateQueries({ queryKey: ['transactions'] });
        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: ['dailyTrend'] });
        qc.invalidateQueries({ queryKey: ['categoryBreakdown'] });
        qc.invalidateQueries({ queryKey: ['monthlyTrend'] });
        qc.invalidateQueries({ queryKey: ['bankBreakdown'] });
      }
    },
    [qc],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleChange);
    return () => sub.remove();
  }, [handleChange]);

  return null;
}

// ── Auth redirect ─────────────────────────────────────────────────────────────
// Lives inside a child so it has access to expo-router context.
function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Slot />;
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const { loadStoredAuth, isLoading } = useAuthStore();

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Hide native splash once both fonts and auth state are ready
  useEffect(() => {
    if ((fontsLoaded || fontError) && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  // Keep native splash visible while loading
  if ((!fontsLoaded && !fontError) || isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppStateRefresh />
          <RootLayoutNav />
          <OfflineBanner />
          <Toast topOffset={60} />
          <StatusBar style="light" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
