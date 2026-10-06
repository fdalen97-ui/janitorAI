import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  clearLostMedia,
  useLostMediaNotice,
  useMediaUploadError,
  useOversizedFileError,
  useProjectTooLarge,
} from '@/src/sync/syncStatus';
import { Caption, useAppTheme } from '@/src/ui';

// Varselbannerne («fil for stor», «tapte bilder») bruker temaets warn-farger,
// som har egne mørk-modus-varianter — de hardkodede ravfargene hadde ikke det
// (UX-revisjon 10.2026). Rødt (danger) er forbeholdt synkfeil.

/**
 * Lukkeknapp med 44×44 trykkflate (padding, ikke hitSlop — hitSlop virker
 * ikke pålitelig på web). Ikonet er pynt; etiketten bærer betydningen.
 */
function DismissButton({ onPress, label, color }: { onPress: () => void; label: string; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', margin: -8 }}
    >
      <Ionicons name="close-outline" size={20} color={color} />
    </Pressable>
  );
}

/**
 * Renders up to two inline banners:
 *
 * 1. Amber — "file too large": shown immediately when any upload is rejected
 *    with FILE_TOO_LARGE. Dismissible per-session. Does NOT wait for the
 *    three-failure threshold.
 *
 * 2. Red — generic connectivity failure: shown after repeated upload failures
 *    unrelated to file size (network errors, server errors, etc.).
 *
 * Both are dismissible per-session; the underlying state persists so the sync
 * status indicator continues to reflect the error condition.
 */
export default function MediaUploadErrorBanner() {
  const theme = useAppTheme();
  const mediaError = useMediaUploadError();
  const oversizedError = useOversizedFileError();

  const [genericDismissed, setGenericDismissed] = useState(false);
  const [oversizedDismissed, setOversizedDismissed] = useState(false);

  // Reset dismissed states whenever the underlying error clears.
  React.useEffect(() => {
    if (!mediaError) setGenericDismissed(false);
  }, [mediaError]);

  React.useEffect(() => {
    if (!oversizedError) setOversizedDismissed(false);
  }, [oversizedError]);

  const lostMedia = useLostMediaNotice();
  const tooLargeProjectId = useProjectTooLarge();
  const [tooLargeDismissed, setTooLargeDismissed] = useState(false);

  React.useEffect(() => {
    if (!tooLargeProjectId) setTooLargeDismissed(false);
  }, [tooLargeProjectId]);

  const showOversized = oversizedError && !oversizedDismissed;
  const showGeneric = mediaError && !genericDismissed;
  const showLost = lostMedia !== null;
  const showTooLarge = Boolean(tooLargeProjectId) && !tooLargeDismissed;

  if (!showOversized && !showGeneric && !showLost && !showTooLarge) return null;

  return (
    <>
      {showTooLarge && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.danger + '22',
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.danger + '55',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.danger} />
          <Caption style={{ flex: 1, color: theme.colors.danger }}>
            Et prosjekt er for stort til å synkroniseres til serveren, og nye endringer i det blir
            bare lagret på denne enheten. Ta kontakt med oss, så løser vi det.
          </Caption>
          <DismissButton
            onPress={() => setTooLargeDismissed(true)}
            label="Lukk varsel om prosjektstørrelse"
            color={theme.colors.danger}
          />
        </View>
      )}
      {showLost && lostMedia && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.warnBg,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.warnBorder,
            marginBottom: theme.spacing.sm,
          }}
        >
          <Ionicons name="image-outline" size={18} color={theme.colors.warn} />
          <Caption style={{ flex: 1, color: theme.colors.warn }}>
            {lostMedia.count === 1
              ? 'Ett bilde gikk tapt fordi appen ble lukket før opplastingen var ferdig. Legg det til på nytt fra kamerarullen.'
              : `${lostMedia.count} bilder gikk tapt fordi appen ble lukket før opplastingen var ferdig. Legg dem til på nytt fra kamerarullen.`}
          </Caption>
          <DismissButton
            onPress={() => clearLostMedia()}
            label="Lukk varsel om tapte bilder"
            color={theme.colors.warn}
          />
        </View>
      )}
      {showOversized && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.warnBg,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.warnBorder,
            marginBottom: theme.spacing.sm,
          }}
        >
          <Ionicons name="alert-circle-outline" size={18} color={theme.colors.warn} />
          <Caption style={{ flex: 1, color: theme.colors.warn }}>
            Én eller flere filer er for store til å lastes opp (bilder maks 50 MB, videoer maks
            500 MB). Kort ned videoene eller eksporter i lavere oppløsning.
          </Caption>
          <DismissButton
            onPress={() => setOversizedDismissed(true)}
            label="Lukk varsel om filstørrelse"
            color={theme.colors.warn}
          />
        </View>
      )}

      {showGeneric && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.danger + '22',
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.danger + '55',
            marginBottom: theme.spacing.sm,
          }}
        >
          <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.danger} />
          <Caption style={{ flex: 1, color: theme.colors.danger }}>
            Bilder og videoer ble ikke synkronisert til serveren. Dataene er lagret på denne
            enheten. Vi prøver igjen automatisk i bakgrunnen.
          </Caption>
          <DismissButton
            onPress={() => setGenericDismissed(true)}
            label="Lukk varsel om medieopplasting"
            color={theme.colors.danger}
          />
        </View>
      )}
    </>
  );
}
