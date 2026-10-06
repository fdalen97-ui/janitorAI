import { Ionicons } from '@expo/vector-icons';
import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body } from './Typography';
import { useAppTheme } from './theme';

export type ToastVariant = 'success' | 'error' | 'info';

type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  show: (options: ToastOptions | string) => void;
};

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const ICONS: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

// Fargepar med minst 4,5:1-kontrast i begge temaer (B20-kravet gjelder også toasts).
const COLORS: Record<'light' | 'dark', Record<ToastVariant, { bg: string; fg: string; border: string }>> = {
  light: {
    success: { bg: '#DCEFE3', fg: '#14532D', border: '#8FC9A0' },
    error: { bg: '#FCE5E1', fg: '#7F1D1D', border: '#EFAF9F' },
    info: { bg: '#E5ECF3', fg: '#1D374B', border: '#A8C2D6' },
  },
  dark: {
    success: { bg: '#0F2E1D', fg: '#8FC9A0', border: '#166534' },
    error: { bg: '#3B1513', fg: '#EFAF9F', border: '#7F1D1D' },
    info: { bg: '#192834', fg: '#B4D2EB', border: '#3C596F' },
  },
};

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Required<ToastOptions> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((options: ToastOptions | string) => {
    const normalized = typeof options === 'string' ? { message: options } : options;
    setToast({
      message: normalized.message,
      variant: normalized.variant ?? 'success',
      durationMs: normalized.durationMs ?? 2600,
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);

    opacity.setValue(0);
    translate.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToast(null);
      });
    }, toast.durationMs);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [toast, opacity, translate]);

  const value = useMemo(() => ({ show }), [show]);
  const mode = theme.mode === 'dark' ? 'dark' : 'light';
  const colors = toast ? COLORS[mode][toast.variant] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && colors && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + theme.spacing.xl + (Platform.OS === 'web' ? 12 : 0),
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={{
              opacity,
              transform: [{ translateY: translate }],
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              maxWidth: 480,
              marginHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bg,
              shadowColor: theme.colors.shadow,
              shadowOpacity: 0.25,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            <Ionicons name={ICONS[toast.variant]} size={18} color={colors.fg} />
            <Body style={{ color: colors.fg, fontWeight: '600', flexShrink: 1 }}>{toast.message}</Body>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
