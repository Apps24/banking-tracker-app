import { View, ActivityIndicator } from 'react-native';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-navy-900">
      <ActivityIndicator size="large" color="#F59E0B" />
    </View>
  );
}
