import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createTheme, Theme, ThemeOptions, PaletteMode } from '@mui/material/styles';
import { heIL } from '@mui/material/locale';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { useTranslation } from 'react-i18next';

interface ThemeContextType {
  theme: Theme;
  mode: PaletteMode;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [mode, setMode] = useState<PaletteMode>('light');
  const isRTL = i18n.language === 'he';

  // Create RTL cache
  const cacheRtl = createCache({
    key: 'muirtl',
    stylisPlugins: isRTL ? [prefixer, rtlPlugin] : [prefixer],
  });

  // Load saved theme mode
  useEffect(() => {
    const savedMode = localStorage.getItem('themeMode') as PaletteMode;
    if (savedMode) {
      setMode(savedMode);
    }
  }, []);

  const toggleColorMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    localStorage.setItem('themeMode', newMode);
  };

  const themeOptions: ThemeOptions = {
    direction: isRTL ? 'rtl' : 'ltr',
    palette: {
      mode,
      primary: {
        main: '#3f51b5',
        light: '#7986cb',
        dark: '#303f9f',
      },
      secondary: {
        main: '#f50057',
        light: '#ff5983',
        dark: '#c51162',
      },
      background: {
        default: mode === 'light' ? '#f5f5f5' : '#121212',
        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
      },
    },
    typography: {
      fontFamily: isRTL
        ? '"Assistant", "Heebo", "Rubik", "Roboto", "Arial", sans-serif'
        : '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 700,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 500,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 500,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 500,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.7,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            padding: '8px 16px',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderBottom: '1px solid',
            borderBottomColor: mode === 'light' ? '#e0e0e0' : '#424242',
          },
        },
      },
    },
  };

  const theme = createTheme(themeOptions, heIL);

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleColorMode }}>
      <CacheProvider value={cacheRtl}>
        {children}
      </CacheProvider>
    </ThemeContext.Provider>
  );
};