import { Pressable, Text, ActivityIndicator, StyleSheet, PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const BG: Record<Variant, string> = {
  primary: '#F59E0B',
  secondary: 'transparent',
  ghost: 'transparent',
  danger: '#E11D48',
};

const BORDER: Record<Variant, string> = {
  primary: 'transparent',
  secondary: '#F59E0B',
  ghost: 'transparent',
  danger: 'transparent',
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: '#0A0F1E',
  secondary: '#F59E0B',
  ghost: '#94A3B8',
  danger: '#FFFFFF',
};

const PADDING: Record<Size, { paddingVertical: number; paddingHorizontal: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 16 },
  md: { paddingVertical: 14, paddingHorizontal: 24 },
  lg: { paddingVertical: 18, paddingHorizontal: 32 },
};

const FONT_SIZE: Record<Size, number> = {
  sm: 13,
  md: 15,
  lg: 17,
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
  ...props
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 350 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 350 });
  };

  const handlePress = async (e: any) => {
    if (!disabled && !loading) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(e);
    }
  };

  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      style={[
        animatedStyle,
        styles.base,
        {
          backgroundColor: BG[variant],
          borderColor: BORDER[variant],
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          ...PADDING[size],
          alignSelf: fullWidth ? 'stretch' : 'auto',
          opacity: isDisabled ? 0.5 : 1,
        },
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#0A0F1E' : '#F59E0B'}
        />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: TEXT_COLOR[variant],
              fontSize: FONT_SIZE[size],
            },
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
