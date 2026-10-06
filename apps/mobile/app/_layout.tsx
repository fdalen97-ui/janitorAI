import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { nb } from '@/src/i18n/nb';
import { AppThemeProvider, ToastProvider } from '@/src/ui';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // «Glass og stål»: samme flatefarger som theme.tsx (background),
  // så navigasjonsoverganger aldri blotter en fremmed farge bak skjermene.
  const stackBackground = colorScheme === 'dark' ? '#091517' : '#E8F5F8';

  useEffect(() => {
    console.log('[Navigation] Root layout mounted with stack background', stackBackground);
  }, [stackBackground]);

  // Set browser tab title on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'DocrAI';
    }
  }, []);

  // Be nettleseren frede lagringen: localStorage (prosjektlisten) og IndexedDB
  // (video før opplasting) er eneste kopi av usynkede feltdata — uten
  // persist() er de «best effort» og kan kastes av nettleseren under
  // lagringspress. Best effort her også: eldre nettlesere mangler API-et.
  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        (navigator as any)?.storage?.persist?.()?.catch?.(() => {});
      } catch {
        // ikke støttet — ufarlig
      }
    }
  }, []);

  return (
    <AppThemeProvider>
      <ToastProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade_from_bottom',
              contentStyle: { backgroundColor: stackBackground },
              headerBackTitle: nb.tabs.home,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </ToastProvider>
    </AppThemeProvider>
  );
}
