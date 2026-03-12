import { useEffect } from 'react';
import { View, Image, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  useEffect(() => {
    // Hide the native splash screen immediately when this component mounts
    SplashScreen.hideAsync();

    // Sequence: logo fades+scales in → title → tagline → hold → fade out
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) });

    textOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    taglineOpacity.value = withDelay(
      800,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Fade out the entire splash after 2.2s total, then call onFinish
    containerOpacity.value = withDelay(
      2200,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      })
    );
  }, []);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Animated logo */}
      <Animated.View style={[styles.logoWrapper, logoStyle]}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App name */}
      <Animated.Text style={[styles.title, textStyle]}>
        BankTracker
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, taglineStyle]}>
        Your finances, simplified
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0F1E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoWrapper: {
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    color: '#F59E0B',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
