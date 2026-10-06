import React from 'react';
import { Pressable, View } from 'react-native';

import { nb } from '@/src/i18n/nb';

import { Caption } from './Typography';
import { useAppTheme } from './theme';

export type ProjectStatus = 'draft' | 'processing' | 'ready' | 'failed';

// Fargepar valgt for minst 4,5:1-kontrast (WCAG AA) mot chip-bakgrunnen
// i begge temaer — B20. Ikke gjenbruk theme.colors her; de er for flater, ikke tekst.
const COLORS: Record<'light' | 'dark', Record<ProjectStatus, { bg: string; fg: string; border: string }>> = {
  light: {
    draft: { bg: '#DFEAEC', fg: '#415053', border: '#C0CDD0' },
    processing: { bg: '#E5ECF3', fg: '#1D374B', border: '#A8C2D6' },
    ready: { bg: '#DCEFE3', fg: '#14532D', border: '#8FC9A0' },
    failed: { bg: '#FCE5E1', fg: '#7F1D1D', border: '#EFAF9F' },
  },
  dark: {
    draft: { bg: '#1E292A', fg: '#C9D3D5', border: '#364548' },
    processing: { bg: '#192834', fg: '#B4D2EB', border: '#3C596F' },
    ready: { bg: '#103524', fg: '#8FC9A0', border: '#166534' },
    failed: { bg: '#3B1513', fg: '#EFAF9F', border: '#7F1D1D' },
  },
};

/** AA-fargeparet for en status — også for filterchips o.l. som viser status som tekst. */
export const statusChipColors = (mode: AppThemeMode, status: ProjectStatus) =>
  COLORS[mode === 'dark' ? 'dark' : 'light'][status];

type AppThemeMode = ReturnType<typeof useAppTheme>['mode'];

type Props = {
  status: ProjectStatus;
  // B20: «Feilet» skal alltid tilby en handling, ikke bare en feilmelding.
  onRetry?: () => void;
};

export const StatusChip = ({ status, onRetry }: Props) => {
  const theme = useAppTheme();
  const mode = theme.mode === 'dark' ? 'dark' : 'light';
  const colors = COLORS[mode][status];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        accessible
        accessibilityLabel={`Status: ${nb.status[status]}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: theme.radii.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.fg }} />
        <Caption style={{ color: colors.fg, fontWeight: '600' }}>{nb.status[status]}</Caption>
      </View>
      {status === 'failed' && onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={nb.common.retry}
          // 44 px trykkflate uten å gjøre selve pillen høyere enn statuschipen.
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: theme.radii.pill,
              borderWidth: 1,
              borderColor: theme.colors.accent,
            }}
          >
            <Caption style={{ color: theme.colors.accent, fontWeight: '600' }}>{nb.common.retry}</Caption>
          </View>
        </Pressable>
      )}
    </View>
  );
};
