import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { nb } from '@/src/i18n/nb';
import { Body, Caption, SecondaryButton, useAppTheme, useToast } from '@/src/ui';

// ─── Step definitions ─────────────────────────────────────────────────────────
// NB: trinnene går videre på faste tidsur — klienten får ingen fremdrift fra
// serveren. Derfor merkes listen som et anslag i UI-et (UX-revisjon 10.2026),
// og siste trinn blir stående aktivt til svaret faktisk kommer.

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  durationMs: number;
};

const STEPS: Step[] = [
  { icon: 'videocam-outline', label: nb.report.generatingSteps[0], durationMs: 3000 },
  { icon: 'mic-outline', label: nb.report.generatingSteps[1], durationMs: 4500 },
  { icon: 'sparkles-outline', label: nb.report.generatingSteps[2], durationMs: 3000 },
  { icon: 'document-text-outline', label: nb.report.generatingSteps[3], durationMs: 99999 },
];

// ─── Pulsing orb ─────────────────────────────────────────────────────────────

function PulsingOrb() {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(reduceMotion ? 1 : 0.55);

  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.5, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [opacity, scale, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ alignItems: 'center', marginBottom: 24 }}>
      <Animated.View
        style={[
          {
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: theme.colors.accent + '20',
            alignItems: 'center',
            justifyContent: 'center',
          },
          animStyle,
        ]}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: theme.colors.accent + '35',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: theme.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="document-text-outline" size={18} color={theme.colors.onAccent} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Animated dots ────────────────────────────────────────────────────────────

function AnimatedDots() {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(1);

  useEffect(() => {
    // Redusert bevegelse: ingen blinkende prikker, bare statisk tekst.
    if (reduceMotion) return;
    const id = setInterval(() => setCount(c => (c % 3) + 1), 500);
    return () => clearInterval(id);
  }, [reduceMotion]);

  if (reduceMotion) {
    return <Caption muted>Pågår</Caption>;
  }

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.accent,
            opacity: i < count ? 1 : 0.25,
          }}
        />
      ))}
    </View>
  );
}

// ─── Step row ─────────────────────────────────────────────────────────────────

type StepState = 'done' | 'active' | 'pending';

function StepRow({ step, state, index }: { step: Step; state: StepState; index: number }) {
  const theme = useAppTheme();
  const isDone = state === 'done';
  const isActive = state === 'active';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).springify()}
      accessible
      focusable={false}
      accessibilityLabel={`${step.label}: ${isDone ? 'antatt ferdig' : isActive ? 'antatt pågående' : 'venter'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: theme.radii.md,
        backgroundColor: isActive ? theme.colors.accent + '12' : 'transparent',
      }}
    >
      {/* Icon / checkmark */}
      <View style={{ width: 30, alignItems: 'center' }}>
        {isDone ? (
          <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />
        ) : (
          <Ionicons
            name={step.icon}
            size={20}
            color={isActive ? theme.colors.foreground : theme.colors.muted}
            style={{ opacity: isActive ? 1 : 0.4 }}
          />
        )}
      </View>

      {/* Label */}
      <Body
        style={{
          flex: 1,
          color: isDone ? theme.colors.accent : isActive ? theme.colors.foreground : theme.colors.muted,
          fontWeight: isActive ? '600' : '400',
          opacity: state === 'pending' ? 0.4 : 1,
        }}
      >
        {step.label}
      </Body>

      {/* Right side */}
      {isActive && <AnimatedDots />}
      {isDone && (
        <Caption style={{ color: theme.colors.accent, opacity: 0.65 }}>{nb.common.done}</Caption>
      )}
    </Animated.View>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
};

export function ReportGeneratingOverlay({ visible }: Props) {
  const theme = useAppTheme();
  const toast = useToast();
  const steps = STEPS;
  const [currentStep, setCurrentStep] = useState(0);
  // «Skjul» lukker bare visningen — genereringen eies av kalleren og løper
  // videre; suksess-/feilmeldingen kommer som toast når den er ferdig.
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    setHidden(true);
    toast.show({
      message: 'Rapporten lages videre i bakgrunnen. Du får en melding når den er klar.',
      variant: 'info',
      durationMs: 5000,
    });
  };

  useEffect(() => {
    if (!visible) {
      setCurrentStep(0);
      setHidden(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    let step = 0;

    const advance = () => {
      if (step >= steps.length - 1) return;
      step += 1;
      setCurrentStep(step);
      timerRef.current = setTimeout(advance, steps[step].durationMs);
    };

    timerRef.current = setTimeout(advance, steps[0].durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, steps]);

  if (!visible || hidden) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible && !hidden}
      statusBarTranslucent
      // Android-tilbakeknappen (og Esc på web) skjuler bare overlegget.
      onRequestClose={hide}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.52)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Animated.View
          entering={FadeIn.springify()}
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            padding: 28,
            borderWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.2,
            shadowRadius: 28,
            elevation: 14,
          }}
        >
          <PulsingOrb />

          <Body style={{ fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 6 }}>
            {nb.report.generating}
          </Body>
          <Caption muted style={{ textAlign: 'center', marginBottom: 22 }}>
            KI-en jobber med rapporten. Det kan ta noen minutter. Trinnene under er et anslag,
            ikke målt fremdrift.
          </Caption>

          <Caption muted style={{ fontWeight: '600', marginBottom: 4 }}>Typiske trinn (anslag)</Caption>
          <View style={{ gap: 2 }}>
            {steps.map((step, i) => (
              <StepRow
                key={step.label}
                step={step}
                index={i}
                state={i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'}
              />
            ))}
          </View>

          <SecondaryButton onPress={hide} style={{ marginTop: 20 }}>
            Skjul – rapporten lages videre i bakgrunnen
          </SecondaryButton>
        </Animated.View>
      </View>
    </Modal>
  );
}
