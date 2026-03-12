import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function Header({ title, showBack, right }: HeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between px-4 py-4">
      {showBack ? (
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 32 }} />
      )}
      <Text className="text-white text-lg font-semibold">{title}</Text>
      <View style={{ width: 32 }}>{right}</View>
    </View>
  );
}
