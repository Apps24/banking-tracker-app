import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'danger' | 'warning' | 'info';
}

export function Badge({ label, variant = 'info' }: BadgeProps) {
  const variants = {
    success: 'bg-green-900 text-green-400',
    danger: 'bg-red-900 text-red-400',
    warning: 'bg-yellow-900 text-yellow-400',
    info: 'bg-blue-900 text-blue-400',
  };

  return (
    <View className={`rounded-full px-3 py-1 self-start ${variants[variant].split(' ')[0]}`}>
      <Text className={`text-xs font-medium ${variants[variant].split(' ')[1]}`}>{label}</Text>
    </View>
  );
}
