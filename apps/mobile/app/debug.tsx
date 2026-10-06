/**
 * Feilsøkingsskjerm
 *
 * Viser kjøretidskonfigurasjon og helsestatus for API-et.
 * Bare tilgjengelig i utviklingsbygg (isDevelopment()).
 */

import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { getApiBaseUrl, getApiHealthUrl, getBuildProfile, isDevelopment } from '../src/config/api';
import { Body, Caption, GlassCard, PrimaryButton, Screen, SecondaryButton, Title, useAppTheme } from '../src/ui';

interface HealthCheckResponse {
  status: string;
  [key: string]: unknown;
}

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={{ gap: 2 }}>
    <Caption muted style={{ fontWeight: '600' }}>{label}</Caption>
    <Body selectable>{value}</Body>
  </View>
);

export default function DebugScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [healthStatus, setHealthStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setHealthStatus('loading');
    setErrorMessage('');
    try {
      const response = await fetch(getApiHealthUrl(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
        setHealthStatus('ok');
      } else {
        setHealthStatus('error');
        setErrorMessage(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setHealthStatus('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const header = <Stack.Screen options={{ title: 'Feilsøking' }} />;

  // Ikke tilgjengelig i produksjonsbygg
  if (!isDevelopment()) {
    return (
      <>
        {header}
        <Screen scrollable={false}>
          <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
            <Title accessibilityRole="header">Feilsøking er ikke tilgjengelig</Title>
            <Body muted>Denne siden finnes bare i utviklingsbygg.</Body>
            <PrimaryButton onPress={() => router.back()}>Gå tilbake</PrimaryButton>
          </View>
        </Screen>
      </>
    );
  }

  const codeBlockStyle = {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  };

  return (
    <>
      {header}
      <Screen>
        <View style={{ gap: theme.spacing.md }}>
          <Title accessibilityRole="header">Feilsøkingsinformasjon</Title>

          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Title accessibilityRole="header" style={{ fontSize: 18 }}>Byggkonfigurasjon</Title>
            <Row label="Byggprofil" value={getBuildProfile() || 'Ikke konfigurert'} />
            <Row label="Utviklingsmodus" value={isDevelopment() ? 'Ja' : 'Nei'} />
          </GlassCard>

          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Title accessibilityRole="header" style={{ fontSize: 18 }}>API-konfigurasjon</Title>
            <Row label="Base-URL" value={getApiBaseUrl()} />
            <Row label="Helse-URL" value={getApiHealthUrl()} />
          </GlassCard>

          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Title accessibilityRole="header" style={{ fontSize: 18 }}>Helsesjekk av API-et</Title>

            {healthStatus === 'loading' && (
              <View style={{ alignItems: 'center', gap: theme.spacing.sm }} accessibilityLiveRegion="polite">
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Body muted>Sjekker API-et …</Body>
              </View>
            )}

            {healthStatus === 'ok' && (
              <View style={{ gap: theme.spacing.sm }} accessibilityLiveRegion="polite">
                <Body style={{ color: theme.colors.accentStrong, fontWeight: '600' }}>API-et svarer.</Body>
                {healthData && (
                  <View style={codeBlockStyle}>
                    <Caption selectable style={{ fontFamily: MONO }}>
                      {JSON.stringify(healthData, null, 2)}
                    </Caption>
                  </View>
                )}
              </View>
            )}

            {healthStatus === 'error' && (
              <View style={{ gap: theme.spacing.sm }} accessibilityLiveRegion="polite">
                <Body style={{ color: theme.colors.danger, fontWeight: '600' }}>
                  API-et svarer ikke. Sjekk adressen over og at serveren kjører, og prøv igjen.
                </Body>
                {!!errorMessage && (
                  <View style={codeBlockStyle}>
                    <Caption selectable style={{ fontFamily: MONO, color: theme.colors.danger }}>
                      {errorMessage}
                    </Caption>
                  </View>
                )}
              </View>
            )}

            <PrimaryButton onPress={checkHealth} loading={healthStatus === 'loading'}>
              Sjekk på nytt
            </PrimaryButton>
          </GlassCard>

          <SecondaryButton onPress={() => router.back()}>Gå tilbake</SecondaryButton>
        </View>
      </Screen>
    </>
  );
}
