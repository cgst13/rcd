import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0284c7', // Sky 600 - rich light blue
      light: '#e0f2fe', // Sky 100 - soft ice blue
      dark: '#0369a1', // Sky 700 - deep sky blue
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0ea5e9', // Sky 500 - vibrant blue
      light: '#f0f9ff', // Sky 50 - ultra light blue
      dark: '#0284c7',
      contrastText: '#ffffff',
    },
    info: {
      main: '#38bdf8',
      light: '#e0f2fe',
      dark: '#0284c7',
    },
    success: {
      main: '#10b981',
      light: '#d1fae5',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b',
      light: '#fef3c7',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',
      light: '#fee2e2',
      dark: '#b91c1c',
    },
    background: {
      default: '#f8fafc', // Slate 50 - very clean light bg
      paper: '#ffffff', // Pure white cards
    },
    text: {
      primary: '#0f172a', // Slate 900
      secondary: '#64748b', // Slate 500
    },
    divider: '#e2e8f0', // Clean small border divider
  },
  typography: {
    fontFamily: [
      'Inter',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 800, letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, letterSpacing: '-0.025em' },
    h3: { fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { fontSize: '0.95rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 6, // Small clean border radius
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8fafc',
          color: '#0f172a',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#ffffff',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          boxShadow: 'none',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          boxShadow: 'none',
          transition: 'border-color 0.2s ease',
          '&:hover': {
            borderColor: '#cbd5e1',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: 7,
          border: '1px solid #e2e8f0',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: '#f1f5f9',
            borderColor: '#cbd5e1',
          },
        },
        colorPrimary: {
          backgroundColor: '#f0f9ff',
          color: '#0284c7',
          borderColor: '#bae6fd',
          '&:hover': {
            backgroundColor: '#0284c7',
            color: '#ffffff',
            borderColor: '#0284c7',
          },
        },
        colorSecondary: {
          backgroundColor: '#f0f9ff',
          color: '#0ea5e9',
          borderColor: '#bae6fd',
          '&:hover': {
            backgroundColor: '#0ea5e9',
            color: '#ffffff',
            borderColor: '#0ea5e9',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '6px 14px',
          fontWeight: 600,
          textTransform: 'none',
          border: '1px solid transparent',
          transition: 'all 0.15s ease',
        },
        containedPrimary: {
          backgroundColor: '#0284c7',
          borderColor: '#0284c7',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#0369a1',
            borderColor: '#0369a1',
          },
        },
        outlinedPrimary: {
          borderColor: '#e2e8f0',
          color: '#0284c7',
          backgroundColor: '#ffffff',
          '&:hover': {
            backgroundColor: '#f0f9ff',
            borderColor: '#0284c7',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e2e8f0',
            borderWidth: '1px',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#94a3b8',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#0284c7',
            borderWidth: '1px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#f1f5f9',
          padding: '10px 14px',
        },
        head: {
          fontWeight: 700,
          backgroundColor: '#f8fafc',
          color: '#475569',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: '#f8fafc !important',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
          fontSize: '0.75rem',
          border: '1px solid #e2e8f0',
        },
        colorPrimary: {
          backgroundColor: '#e0f2fe',
          color: '#0369a1',
          borderColor: '#bae6fd',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0f172a',
          color: '#ffffff',
          fontSize: '0.76rem',
          fontWeight: 500,
          borderRadius: 4,
          padding: '5px 10px',
        },
      },
    },
  },
});
