import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { Caption } from './Typography';
import { useAppTheme } from './theme';

export type TextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  rightIcon?: React.ReactNode;
};

export const TextField = ({
  label,
  helperText,
  error,
  style,
  rightIcon,
  onFocus,
  onBlur,
  onPressIn,
  accessibilityLabel,
  ...props
}: TextFieldProps) => {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const Wrapper: React.ElementType = onPressIn ? Pressable : View;
  const wrapperProps = onPressIn ? { onPressIn, accessible: false, tabIndex: -1 } : {};

  const borderColor = error
    ? theme.colors.danger
    : isFocused
    ? theme.colors.accent
    : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label && <Caption style={{ color: theme.colors.muted }}>{label}</Caption>}
      {/* Innpakningen er bare for onPressIn; den skal ikke være et eget
          tabulatorstopp uten navn (react-native-web gir Pressable tabindex=0). */}
      <Wrapper {...wrapperProps}>
        <View>
          <TextInput
            {...props}
            // Etiketten må være koblet til feltet, ellers leser skjermleseren
            // bare plassholderen (eller ingenting). Feil og hjelpetekst følger med.
            accessibilityLabel={accessibilityLabel ?? label ?? props.placeholder}
            accessibilityHint={error || helperText}
            aria-invalid={!!error}
            placeholderTextColor={theme.colors.muted}
            onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
            }}
            style={[
              styles.input,
              {
                borderColor,
                backgroundColor: theme.colors.surface,
                color: theme.colors.foreground,
                padding: theme.spacing.sm,
                paddingRight: rightIcon ? theme.spacing.lg * 1.2 : theme.spacing.sm,
                borderRadius: theme.radii.md,
              },
              style,
            ]}
          />
          {rightIcon && <View style={[styles.icon, { right: theme.spacing.sm }]}>{rightIcon}</View>}
        </View>
      </Wrapper>
      {!!error && (
        <Caption style={{ color: theme.colors.danger }} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Caption>
      )}
      {!error && helperText && <Caption style={{ color: theme.colors.muted }}>{helperText}</Caption>}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    fontSize: 16,
    // 44 px: minste trykkflate (Apple HIG), også for felt.
    minHeight: 44,
  },
  icon: {
    position: 'absolute',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
