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
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { nb } from '@/src/i18n/nb';

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

// Feil og info må rekke å leses (og kan inneholde en handling): minst 5 s.
// Suksess er en bekreftelse på noe brukeren nettopp gjorde og kan være kort.
const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  success: 3000,
  error: 7000,
  info: 6000,
};

type ActiveToast = Required<ToastOptions> & { id: number };

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
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback((options: ToastOptions | string) => {
    const normalized = typeof options === 'string' ? { message: options } : options;
    const variant = normalized.variant ?? 'success';
    nextId.current += 1;
    setToast({
      id: nextId.current,
      message: normalized.message,
      variant,
      // Kallere kan forlenge, men ikke korte ned feil/info under standardtiden.
      durationMs:
        variant === 'success'
          ? normalized.durationMs ?? DEFAULT_DURATION_MS.success
          : Math.max(normalized.durationMs ?? 0, DEFAULT_DURATION_MS[variant]),
    });
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      // Nullstill bare hvis det fortsatt er samme toast (en ny kan ha tatt plassen).
      const clear = () => setToast((current) => (current?.id === id ? null : current));
      if (reduceMotion) {
        clear();
        return;
      }
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) clear();
      });
    },
    [opacity, reduceMotion],
  );

  useEffect(() => {
    if (!toast) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);

    // iOS VoiceOver leser ikke live-regioner; Android (accessibilityLiveRegion)
    // og web (role="alert") gjør det selv — annonser bare på iOS, ellers dobbelt.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(toast.message);
    }

    if (reduceMotion) {
      // Redusert bevegelse: vis toasten direkte, uten glid og fade.
      opacity.setValue(1);
      translate.setValue(0);
    } else {
      opacity.setValue(0);
      translate.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(translate, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }

    hideTimer.current = setTimeout(() => dismiss(toast.id), toast.durationMs);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [toast, opacity, translate, reduceMotion, dismiss]);

  const value = useMemo(() => ({ show }), [show]);
  const mode = theme.mode === 'dark' ? 'dark' : 'light';
  const colors = toast ? COLORS[mode][toast.variant] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && colors && (
        <View
          // box-none: bare selve toasten tar imot trykk — resten av skjermen
          // under den forblir brukbar.
          pointerEvents="box-none"
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
              maxWidth: 480,
              marginHorizontal: theme.spacing.lg,
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
            <Pressable
              onPress={() => dismiss(toast.id)}
              accessibilityRole="button"
              accessibilityLabel={toast.message}
              accessibilityHint={nb.common.tapToDismiss}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                minHeight: 44,
                paddingVertical: theme.spacing.sm,
                paddingLeft: theme.spacing.lg,
                paddingRight: theme.spacing.md,
              }}
            >
              <Ionicons name={ICONS[toast.variant]} size={18} color={colors.fg} />
              <Body style={{ color: colors.fg, fontWeight: '600', flexShrink: 1 }}>{toast.message}</Body>
              <Ionicons name="close" size={16} color={colors.fg} />
            </Pressable>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
