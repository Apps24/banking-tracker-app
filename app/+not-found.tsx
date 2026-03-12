import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-navy-900">
        <Text className="text-white text-xl font-bold mb-4">Page Not Found</Text>
        <Link href="/" className="text-gold">
          Go to home screen
        </Link>
      </View>
    </>
  );
}
