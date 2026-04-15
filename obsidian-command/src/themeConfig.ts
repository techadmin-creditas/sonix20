/**
 * Global Theme Configuration for Sonix Studio
 * Use this file to manage all brand colors and visual tokens in one place.
 */

export const themeConfig = {
  selectedBrand: 'amber' as 'amber' | 'nocturnal',
  selectedMode: 'light' as 'light' | 'dark',
  
  amber: {
    light: {
      primary: '#8f4e00',
      primaryContainer: '#ffcc99',
      onPrimaryFixed: '#ffffff',
      secondary: '#944b00',
      secondaryContainer: '#ffdcc3',
      tertiary: '#705b40',
      background: '#fdf8f5',
      surface: '#fffbff',
      surfaceLow: '#f7f3f1',
      surfaceHigh: '#f1edeb',
      surfaceHighest: '#ebe7e5',
      surfaceLowest: '#ffffff',
      onSurface: '#1f1b16',
      onSurfaceVariant: '#50453a',
      outline: '#827568',
      outlineVariant: '#d4c4b5',
      inputBg: '#f2f2f2',
    },
    dark: {
      primary: '#ffb77b',
      primaryContainer: '#fb8c00',
      onPrimaryFixed: '#2e1500',
      secondary: '#ffb68e',
      secondaryContainer: '#ab4c00',
      tertiary: '#e0c1a9',
      background: '#050608',
      surface: '#121316',
      surfaceLow: '#1a1c1e',
      surfaceHigh: '#292a2d',
      surfaceHighest: '#343538',
      surfaceLowest: '#0d0e11',
      onSurface: '#e3e2e5',
      onSurfaceVariant: '#dcc1ae',
      outline: '#a48c7a',
      outlineVariant: '#564334',
      inputBg: '#262a31',
    }
  },
  
  nocturnal: {
    light: {
      primary: '#7c87f3',
      primaryContainer: '#bdc2ff',
      onPrimaryFixed: '#ffffff',
      secondary: '#bdc2ff',
      secondaryContainer: '#eff2f5',
      tertiary: '#4cd6ff',
      background: '#f4f7fa',
      surface: '#ffffff',
      surfaceLow: '#eff2f5',
      surfaceHigh: '#e5e9ef',
      surfaceHighest: '#d7dce4',
      surfaceLowest: '#ffffff',
      onSurface: '#0c1324',
      onSurfaceVariant: '#464554',
      outline: '#a4a9b3',
      outlineVariant: '#d7dce4',
      inputBg: '#eff2f5',
    },
    dark: {
      primary: '#bdc2ff',
      primaryContainer: '#7c87f3',
      onPrimaryFixed: '#ffffff',
      secondary: '#7c87f3',
      secondaryContainer: '#191f31',
      tertiary: '#4cd6ff',
      background: '#0c1324',
      surface: '#0c1324',
      surfaceLow: '#151b2d',
      surfaceHigh: '#191f31',
      surfaceHighest: '#2e3447',
      surfaceLowest: '#070d1f',
      onSurface: '#e0e8ff',
      onSurfaceVariant: '#c7c4d7',
      outline: '#464554',
      outlineVariant: '#464554',
      inputBg: '#151b2d',
    }
  }
};

export type ThemeColors = typeof themeConfig.amber.light;
