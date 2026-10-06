import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { nb } from '@/src/i18n/nb';
import { useAppTheme } from '@/src/ui';

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        // Appens egne tokens (ikke malens #0a7ea4/#fff): aktiv fane i aksent,
        // inaktive i dempet tekstfarge — begge ≥ 4,5:1 mot fanelinjen i lys og mørk modus.
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.muted,
        // 12 px er minstemålet for lesbar etikett (målt 10 px før); halvfet så
        // aktiv fane skiller seg ut også uten fargesyn.
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: nb.tabs.home,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: nb.tabs.guide,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="info.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
