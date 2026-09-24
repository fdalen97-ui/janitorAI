import React, { PropsWithChildren, useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Body } from './Typography';
import { useAppTheme } from './theme';

type ButtonProps = PropsWithChildren<
  PressableProps & {
    loading?: boolean;
    icon?: React.ReactNode;
    width?: ViewStyle['width'];
  }
>;

const PressableScale = ({ children, style, ...props }: ButtonProps & { backgroundColor: string; borderColor?: string; foreground: string; }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    Haptics.selectionAsync();
    scale.value = withSpring(0.98, { damping: 15, stiffness: 220 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 220 });
  }, [scale]);

  const pressableStyle = useMemo(() => {
    const flattenedStyle = StyleSheet.flatten(style as StyleProp<ViewStyle>);
    return {
      overflow: 'hidden' as const,
      borderRadius: flattenedStyle?.borderRadius,
    };
  }, [style]);

  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        props.onPressIn?.(event);
        handlePressIn();
      }}
      onPressOut={(event) => {
        props.onPressOut?.(event);
        handlePressOut();
      }}
      style={pressableStyle}
    >
      <Animated.View style={[animatedStyle, style as StyleProp<ViewStyle>]}>{children}</Animated.View>
    </Pressable>
  );
};

export const PrimaryButton = ({ children, style, loading, disabled, icon, width, ...props }: ButtonProps) => {
  const theme = useAppTheme();
  const baseStyle: ViewStyle = {
    backgroundColor: theme.colors.accent,
    borderColor: 'transparent',
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    width,
    opacity: disabled ? 0.6 : 1,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 3,
  };

  return (
    <PressableScale
      {...props}
      disabled={disabled || loading}
      style={[baseStyle, style as StyleProp<ViewStyle>]}
      backgroundColor={theme.colors.accent}
      foreground={theme.colors.foreground}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon}
          <Body style={{ color: '#fff', fontWeight: '600' }} numberOfLines={1}>{children}</Body>
        </>
      )}
    </PressableScale>
  );
};

export const SecondaryButton = ({ children, style, loading, disabled, icon, width, ...props }: ButtonProps) => {
  const theme = useAppTheme();
  const baseStyle: ViewStyle = {
    backgroundColor: theme.colors.surfaceSecondary,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    width,
    opacity: disabled ? 0.6 : 1,
  };

  return (
    <PressableScale
      {...props}
      disabled={disabled || loading}
      style={[baseStyle, style as StyleProp<ViewStyle>]}
      backgroundColor={theme.colors.surfaceSecondary}
      foreground={theme.colors.foreground}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.foreground} />
      ) : (
        <>
          {icon}
          <Body style={{ color: theme.colors.foreground, fontWeight: '600' }} numberOfLines={1}>{children}</Body>
        </>
      )}
    </PressableScale>
  );
};

export const IconButton = ({ children, style, disabled, ...props }: ButtonProps) => {
  const theme = useAppTheme();
  const baseStyle: ViewStyle = {
    width: 42,
    height: 42,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 2,
  };

  return (
    <PressableScale {...props} disabled={disabled} style={[baseStyle, style as StyleProp<ViewStyle>]} backgroundColor={theme.colors.surface} foreground={theme.colors.foreground}>
      {children}
    </PressableScale>
  );
};
