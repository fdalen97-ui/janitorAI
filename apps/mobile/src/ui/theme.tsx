import React, { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';

export type AppTheme = {
  mode: ColorSchemeName;
  colors: {
    background: string;
    surface: string;
    surfaceSecondary: string;
    foreground: string;
    muted: string;
    border: string;
    accent: string;
    accentStrong: string;
    danger: string;
    /**
     * Signaturdetaljen (navnet er historisk: i «Skifer og kobber» var den
     * kobber, i «Glass og stål» er den stålblå). Brukes KUN på
     * godkjenningsstempel og nøkkeltall — aldri på knapper eller flater.
     */
    copper: string;
    shadow: string;
    glassOverlay: string;
    overlay: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radii: { sm: number; md: number; lg: number; pill: number };
  typography: {
    title: { fontSize: number; fontWeight: '700' | '600'; letterSpacing: number };
    body: { fontSize: number; fontWeight: '400' | '500'; letterSpacing: number };
    caption: { fontSize: number; fontWeight: '400'; letterSpacing: number };
  };
  blurIntensity: number;
};

// Fargeidentiteten deles med salgs-, demo- og delingssidene: «Glass og stål»
// (tema 17 i fargebiblioteket, valgt av teamet 05.10.2026) — stålblå aksent
// (#2F4A5E), kjølig glassgrå bakgrunn og gult kun for det kritiske. Stempel og
// nøkkeltall bruker stålblått (feltet heter fortsatt `copper`). Bevisst valgt bort:
// knallblå/neonrød «template-farger» og tung glass/blur — takstbransjen skal
// kjenne igjen et fagverktøy, ikke en demo.
const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    background: '#E8F5F8',
    surface: 'rgba(251,254,255,0.96)',
    surfaceSecondary: 'rgba(251,254,255,0.85)',
    foreground: '#072227',
    muted: '#596D71',
    border: 'rgba(7, 34, 39, 0.16)',
    accent: '#2F4A5E',
    accentStrong: '#1D374B',
    danger: '#B63B32',
    // Stålblått som stempel og nøkkeltall: 8,3:1 på bakgrunnen #E8F5F8.
    copper: '#2F4A5E',
    shadow: 'rgba(7, 34, 39, 0.10)',
    glassOverlay: 'rgba(255,255,255,0.5)',
    overlay: 'rgba(7, 34, 39, 0.30)',
  },
  spacing: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  radii: { sm: 6, md: 10, lg: 16, pill: 999 },
  typography: {
    title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.2 },
    body: { fontSize: 16, fontWeight: '400', letterSpacing: -0.1 },
    caption: { fontSize: 13, fontWeight: '400', letterSpacing: 0 },
  },
  blurIntensity: 12,
};

const darkTheme: AppTheme = {
  mode: 'dark',
  colors: {
    background: '#091517',
    surface: 'rgba(19, 32, 34, 0.97)',
    surfaceSecondary: 'rgba(19, 32, 34, 0.88)',
    foreground: '#E6ECEE',
    muted: '#9FAEB1',
    border: 'rgba(159, 174, 177, 0.28)',
    accent: '#A1BFD7',
    accentStrong: '#B4D2EB',
    danger: '#DF695C',
    copper: '#97B5CD',
    shadow: 'rgba(0, 0, 0, 0.35)',
    glassOverlay: 'rgba(9, 21, 23, 0.5)',
    overlay: 'rgba(0,0,0,0.5)',
  },
  spacing: lightTheme.spacing,
  radii: lightTheme.radii,
  typography: lightTheme.typography,
  blurIntensity: 14,
};

const ThemeContext = createContext<AppTheme>(lightTheme);

export const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const scheme = useColorScheme();

  const theme = useMemo(() => (scheme === 'dark' ? darkTheme : lightTheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);
