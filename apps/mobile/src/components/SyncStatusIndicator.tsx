import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { nb } from '@/src/i18n/nb';
import { useSyncStatus, useMediaUploadError, useMediaBatchProgress, SyncState } from '@/src/sync/syncStatus';
import { Caption, useAppTheme } from '@/src/ui';

const LABELS: Record<SyncState, string> = {
  idle: nb.sync.idle,
  syncing: nb.sync.syncing,
  synced: nb.sync.synced,
  offline: nb.sync.offline,
  error: nb.sync.error,
  disabled: nb.sync.disabled,
};

const ICONS: Record<SyncState, keyof typeof Ionicons.glyphMap> = {
  idle: 'cloud-outline',
  syncing: 'cloud-upload-outline',
  synced: 'cloud-done-outline',
  offline: 'cloud-offline-outline',
  error: 'alert-circle-outline',
  disabled: 'cloud-offline-outline',
};

type Props = {
  onSyncNow?: () => void;
};

export default function SyncStatusIndicator({ onSyncNow }: Props) {
  const theme = useAppTheme();
  const status = useSyncStatus();
  const mediaError = useMediaUploadError();
  const batchProgress = useMediaBatchProgress();

  // When media uploads are failing, override the color and icon even if the
  // project push itself succeeded — the inspector's files aren't fully safe.
  const hasMediaError = mediaError !== null;

  const color =
    status === 'error' || hasMediaError
      ? theme.colors.danger
      : status === 'synced'
      ? theme.colors.accentStrong
      : theme.colors.foreground;

  const icon: keyof typeof Ionicons.glyphMap =
    hasMediaError && status !== 'error' ? 'alert-circle-outline' : ICONS[status];

  // Pilotfunn (aug 2026): uten teller vet ikke takstpersonen om opplastingen
  // jobber eller henger — vis «Laster opp X av Y» mens batchen pågår.
  const label = batchProgress
    ? nb.sync.uploadingProgress(batchProgress.done, batchProgress.total)
    : hasMediaError && status === 'synced'
      ? nb.sync.mediaNotSynced
      : LABELS[status];

  const canSync = !!onSyncNow && status !== 'syncing';
  // Skjermleseren må høre selve statusen («Venter på nett …») — ikke bare
  // handlingen. Handlingen legges etter, og bare når den faktisk er mulig.
  const a11yLabel = canSync ? `${label}. ${nb.sync.tapToSync}` : label;

  return (
    <Pressable
      onPress={onSyncNow}
      disabled={!canSync}
      accessibilityRole={onSyncNow ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: !canSync, busy: status === 'syncing' }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        // 44 px trykkflate (var ~28 px).
        minHeight: 44,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        backgroundColor: theme.colors.surfaceSecondary,
        borderRadius: theme.radii.pill,
      }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Caption style={{ color, flexShrink: 1 }}>{label}</Caption>
      {canSync && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="refresh-outline" size={15} color={theme.colors.foreground} />
        </View>
      )}
    </Pressable>
  );
}
