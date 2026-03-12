import { Stack } from 'expo-router';

export default function AuthLayout() {
  // Auth redirect is handled centrally in the root _layout.tsx via useSegments + useRouter.
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
