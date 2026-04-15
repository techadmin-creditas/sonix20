import React, { useEffect } from 'react';
import { themeConfig } from '../themeConfig';
import { useTheme } from '../lib/theme';

/**
 * ThemeSynchronizer maps the TypeScript theme configuration to CSS variables.
 * This allows managing the entire project's colors from a single themeConfig.ts file.
 */
export const ThemeSynchronizer: React.FC = () => {
  const { theme } = useTheme();

  useEffect(() => {
    const applyTheme = () => {
      const brand = themeConfig.selectedBrand;
      const colors = themeConfig[brand][theme];
      const root = document.documentElement;

      // Map camelCase config keys to kebab-case CSS variables
      Object.entries(colors).forEach(([key, value]) => {
        const cssVarName = `--${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
        root.style.setProperty(cssVarName, value as string);
      });
    };

    applyTheme();
  }, [theme]);

  return null;
};
