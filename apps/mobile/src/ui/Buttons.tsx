import React, { PropsWithChildren, useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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

/**
 * Ikonet ved siden av knappeteksten er pynt: skjul det for skjermleser, og
 * gi det knappens tekstfarge så det aldri får egen (feil) kontrast.
 */
const DecorativeIcon = ({ icon, color }: { icon: React.ReactNode; color: string }) => {
  if (!icon) return null;
  const tinted = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<{ color?: string }>, { color })
    : icon;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {tinted}
    </View>
  );
};

/** Tekstetikett for skjermleser når knappen viser spinner i stedet for tekst. */
const labelOf = (children: React.ReactNode) => (typeof children === 'string' ? children : undefined);

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

  // Layout-egenskaper (flex, bredde, marg, alignSelf) må ligge på selve
  // trykkflaten. Lå de bare på den indre animerte flaten, ble f.eks.
  // «Tilbake»/«Neste» med flex: 1 smale knapper i stedet for å fylle raden.
  const { pressableStyle, innerStyle } = useMemo(() => {
    const flat = (StyleSheet.flatten(style as StyleProp<ViewStyle>) || {}) as ViewStyle;
    const layoutKeys = [
      'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
      'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
    ] as const;
    const outer: ViewStyle = { overflow: 'hidden', borderRadius: flat.borderRadius };
    const inner: ViewStyle = { ...flat };
    for (const key of layoutKeys) {
      if (flat[key] !== undefined) {
        (outer as Record<string, unknown>)[key] = flat[key];
        delete (inner as Record<string, unknown>)[key];
      }
    }
    // Den indre flaten (bakgrunn, kant, innhold) fyller trykkflaten.
    if (outer.flex !== undefined || outer.flexGrow !== undefined || outer.width !== undefined) {
      inner.flexGrow = 1;
    }
    return { pressableStyle: outer, innerStyle: inner };
  }, [style]);

  return (
    <Pressable
      // Uten rolle ble alle knapper en rolleløs <div> på web og ble ikke
      // annonsert som knapper i VoiceOver/TalkBack (UX-revisjon 10.2026).
      // Kallere kan overstyre via props.
      accessibilityRole="button"
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
      <Animated.View style={[animatedStyle, innerStyle]}>{children}</Animated.View>
    </Pressable>
  );
};

export const PrimaryButton = ({ children, style, loading, disabled, icon, width, ...props }: ButtonProps) => {
  const theme = useAppTheme();
  // Hvit på mørk modus-accent (#A1BFD7) er 1,9:1 — under WCAG AA. onAccent er
  // mørk i mørk modus (9,9:1) og hvit i lys modus (9,3:1 på #2F4A5E).
  const onAccent = theme.colors.onAccent;
  const baseStyle: ViewStyle = {
    backgroundColor: theme.colors.accent,
    minHeight: 48,
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
      accessibilityLabel={labelOf(children)}
      {...props}
      accessibilityState={{ ...props.accessibilityState, disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      style={[baseStyle, style as StyleProp<ViewStyle>]}
      backgroundColor={theme.colors.accent}
      foreground={theme.colors.foreground}
    >
      {loading ? (
        <ActivityIndicator color={onAccent} />
      ) : (
        <>
          <DecorativeIcon icon={icon} color={onAccent} />
          {/* To linjer: ved stor systemtekst skal etiketten brytes, ikke kuttes. */}
          <Body style={{ color: onAccent, fontWeight: '600', textAlign: 'center', flexShrink: 1 }} numberOfLines={2}>{children}</Body>
        </>
      )}
    </PressableScale>
  );
};

export const SecondaryButton = ({
  children,
  style,
  loading,
  disabled,
  icon,
  width,
  tone = 'default',
  ...props
}: ButtonProps & { tone?: 'default' | 'danger' }) => {
  const theme = useAppTheme();
  // «danger»: slett/trekk tilbake. Rød tekst og kant skiller handlingen fra de
  // vanlige knappene uten å gjøre den til skjermens hovedhandling.
  const fg = tone === 'danger' ? theme.colors.danger : theme.colors.foreground;
  const baseStyle: ViewStyle = {
    backgroundColor: theme.colors.surfaceSecondary,
    minHeight: 48,
    borderColor: tone === 'danger' ? theme.colors.danger : theme.colors.border,
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
      accessibilityLabel={labelOf(children)}
      {...props}
      accessibilityState={{ ...props.accessibilityState, disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      style={[baseStyle, style as StyleProp<ViewStyle>]}
      backgroundColor={theme.colors.surfaceSecondary}
      foreground={fg}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <DecorativeIcon icon={icon} color={fg} />
          <Body style={{ color: fg, fontWeight: '600', textAlign: 'center', flexShrink: 1 }} numberOfLines={2}>{children}</Body>
        </>
      )}
    </PressableScale>
  );
};

export const IconButton = ({ children, style, disabled, ...props }: ButtonProps) => {
  const theme = useAppTheme();
  const baseStyle: ViewStyle = {
    // 48 px: minste berøringsflate for hansker (WCAG 2.5.8 krever 24, vi sikter høyere).
    width: 48,
    height: 48,
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
    <PressableScale
      {...props}
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      style={[baseStyle, style as StyleProp<ViewStyle>]}
      backgroundColor={theme.colors.surface}
      foreground={theme.colors.foreground}
    >
      {children}
    </PressableScale>
  );
};
