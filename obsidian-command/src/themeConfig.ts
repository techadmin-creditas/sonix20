/**
 * Global Theme Configuration for Sonix Studio
 * Use this file to manage all brand colors and visual tokens in one place.
 */

export const themeConfig = {
  selectedBrand: 'nocturnal' as 'amber' | 'nocturnal' | 'neuralSlate' | 'prismatic',
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
      displayGradient: 'linear-gradient(135deg, #5c3100 0%, #8f4e00 100%)',
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
      displayGradient: 'linear-gradient(135deg, #ffcc99 0%, #ffb77b 100%)',
      inputBg: '#262a31',
    }
  },

  nocturnal: {
    light: {
      primary: '#6366F1',
      primaryContainer: '#bdc2ff',
      onPrimaryFixed: '#ffffff',
      secondary: '#bdc2ff',
      secondaryContainer: '#eff2f5',
      tertiary: '#4cd6ff',
      background: '#f1f5f9',
      surface: '#ffffff',
      surfaceLow: '#F7F9FC',
      surfaceHigh: '#e5e9ef',
      surfaceHighest: '#d7dce4',
      surfaceLowest: '#ffffff',
      onSurface: '#0c1324',
      onSurfaceVariant: '#464554',
      outline: '#a4a9b3',
      outlineVariant: '#d7dce4',
      displayGradient: 'linear-gradient(135deg, #0A0E27 0%, #344054 100%)',
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
      displayGradient: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
      inputBg: '#151b2d',
    }
  },

  /**
   * prismatic — tri-color light-first theme
   * Light: deep violet (primary) + cyan (secondary) + amber (tertiary)
   * Dark:  bright violet + electric cyan + warm amber on a deep-violet base
   */
  prismatic: {
    light: {
      primary: '#7c3aed',
      primaryContainer: '#ede9fe',
      onPrimaryFixed: '#ffffff',
      secondary: '#0891b2',
      secondaryContainer: '#cffafe',
      tertiary: '#d97706',
      background: '#faf9ff',
      surface: '#ffffff',
      surfaceLow: '#f5f3ff',
      surfaceHigh: '#ede9fe',
      surfaceHighest: '#ddd6fe',
      surfaceLowest: '#ffffff',
      onSurface: '#0f0a1e',
      onSurfaceVariant: '#4c4068',
      outline: '#a99ec4',
      outlineVariant: '#e8e4f7',
      displayGradient: 'linear-gradient(135deg, #2e1065 0%, #7c3aed 100%)',
      inputBg: '#f5f3ff',
    },
    dark: {
      primary: '#a78bfa',
      primaryContainer: '#4c1d95',
      onPrimaryFixed: '#ffffff',
      secondary: '#22d3ee',
      secondaryContainer: '#164e63',
      tertiary: '#fbbf24',
      background: '#0d0b18',
      surface: '#160f2e',
      surfaceLow: '#1e1540',
      surfaceHigh: '#2d2154',
      surfaceHighest: '#3d2e6e',
      surfaceLowest: '#090614',
      onSurface: '#ede9ff',
      onSurfaceVariant: '#b0a4d4',
      outline: '#4c3a7e',
      outlineVariant: '#2d2154',
      displayGradient: 'linear-gradient(135deg, #c4b5fd 0%, #22d3ee 100%)',
      inputBg: '#1e1540',
    },
  },

  neuralSlate: {
    light: {
      primary: '#4f46e5',              // Deep indigo for stronger light-mode presence
      primaryContainer: '#eef2ff',
      onPrimaryFixed: '#ffffff',
      secondary: '#7c3aed',              // Rich violet
      secondaryContainer: '#f5f3ff',
      tertiary: '#06b6d4',              // Vivid cyan accent
      background: '#f1f5f9',            // Slate-100 (Instead of f8f9ff)
      surface: '#ffffff',
      surfaceLow: '#f8fafc',            // Slate-50
      surfaceHigh: '#e2e8f0',           // Slate-200
      surfaceHighest: '#cbd5e1',        // Slate-300
      surfaceLowest: '#ffffff',
      onSurface: '#0f172a',             // Slate-900 for absolute legibility
      onSurfaceVariant: '#475569',      // Slate-600
      outline: '#cbd5e1',               // Slate-300
      outlineVariant: '#e2e8f0',        // Slate-200
      displayGradient: 'linear-gradient(135deg, #0f172a 0%, #4f46e5 100%)',
      inputBg: '#f8fafc',
    },
    dark: {
      primary: '#38bdf8',
      primaryContainer: '#0c4a6e',
      onPrimaryFixed: '#ffffff',
      secondary: '#94a3b8',
      secondaryContainer: '#1e293b',
      tertiary: '#0ea5e9',
      background: '#020617',
      surface: '#0f172a',
      surfaceLow: '#1e293b',
      surfaceHigh: '#334155',
      surfaceHighest: '#475569',
      surfaceLowest: '#020617',
      onSurface: '#f1f5f9',
      onSurfaceVariant: '#94a3b8',
      outline: '#334155',
      outlineVariant: '#1e293b',
      displayGradient: 'linear-gradient(135deg, #f1f5f9 0%, #38bdf8 100%)',
      inputBg: '#1e293b',
    }
  }
};

export type ThemeColors = typeof themeConfig.amber.light;

