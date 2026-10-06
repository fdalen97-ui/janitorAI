import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { nb } from '@/src/i18n/nb';
import { Body, Caption, PrimaryButton, Screen, Title, useAppTheme } from '@/src/ui';

export default function NotFoundScreen() {
  const theme = useAppTheme();

  return (
    <>
      <Stack.Screen options={{ title: nb.notFound.headerTitle }} />
      <Screen scrollable={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 14, maxWidth: 480, alignSelf: 'center', width: '100%' }}>
          <Caption style={{ color: theme.colors.muted, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {nb.notFound.code}
          </Caption>
          <Title accessibilityRole="header">{nb.notFound.title}</Title>
          <Body muted>{nb.notFound.hint}</Body>
          <Link href="/" asChild>
            <PrimaryButton style={{ alignSelf: 'flex-start', marginTop: 6 }}>{nb.notFound.goHome}</PrimaryButton>
          </Link>
        </View>
      </Screen>
    </>
  );
}
