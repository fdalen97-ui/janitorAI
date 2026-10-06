import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { HeaderHeightContext } from '@react-navigation/elements';
import React, { PropsWithChildren, useContext } from 'react';
import { ScrollView, StyleSheet, View, ViewProps } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from './theme';

type ScreenProps = PropsWithChildren<
  ViewProps & {
    scrollable?: boolean;
    /** Overstyr hvilke kanter som får safe area-innrykk (standard: utledet av header/fanelinje). */
    edges?: readonly Edge[];
  }
>;

// Flat, varm bakgrunn fra temaet — gradienter er valgt bort bevisst
// (fargeidentiteten deles med salgs- og delingssidene).
export const Screen = ({ children, style, scrollable = true, edges }: ScreenProps) => {
  const theme = useAppTheme();
  // SafeAreaView fra react-native er bare iOS — Android tegnes kant-til-kant
  // (SDK 54), så innholdet havnet under statuslinja/navigasjonslinja. Header og
  // fanelinje håndterer allerede sin kant; legg bare innrykk der ingen gjør det,
  // ellers blir innrykket dobbelt (særlig på web, der insets alltid legges til).
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const safeEdges: readonly Edge[] =
    edges ??
    ([
      'left',
      'right',
      ...(headerHeight > 0 ? [] : (['top'] as const)),
      ...(tabBarHeight === undefined ? (['bottom'] as const) : []),
    ] as Edge[]);

  const content = (
    <View style={[styles.content, { padding: theme.spacing.lg }, style]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.flex} edges={safeEdges}>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: theme.spacing.xl * 2 }}
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // B14: innhold sentreres med maks-bredde så web/nettbrett ikke strekker kortene.
  content: { flexGrow: 1, width: '100%', maxWidth: 840, alignSelf: 'center' },
});
