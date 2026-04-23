// Symbiodroid Design System — Glass Terminal Metaphor
export const Colors = {
  // Base
  black: '#000000',
  surface0: '#080808',
  surface1: '#0e0e0e',
  surface2: '#141414',
  surface3: '#1c1c1c',
  surfaceGlass: 'rgba(255,255,255,0.04)',
  surfaceGlassHover: 'rgba(255,255,255,0.07)',

  // Brand
  primary: '#00FF94',       // Electric green
  primaryDim: '#00CC76',
  primaryGlow: 'rgba(0,255,148,0.15)',
  primaryBorder: 'rgba(0,255,148,0.3)',

  // Emphasis
  gold: '#FFD700',
  goldDim: '#CC9900',
  goldGlow: 'rgba(255,215,0,0.12)',

  // Accent
  cyan: '#00E5FF',
  cyanDim: 'rgba(0,229,255,0.15)',
  purple: '#8B5CF6',
  red: '#FF4444',
  orange: '#FF8C00',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textTertiary: '#555555',
  textGreen: '#00FF94',
  textGold: '#FFD700',

  // Status
  success: '#00FF94',
  warning: '#FFD700',
  danger: '#FF4444',
  info: '#00E5FF',
  blocked: '#FF4444',
  pass: '#00FF94',

  // Borders
  border: '#1e1e1e',
  borderAccent: 'rgba(0,255,148,0.2)',
  borderGold: 'rgba(255,215,0,0.2)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Typography = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading1: { fontSize: 22, fontWeight: '700' as const },
  heading2: { fontSize: 18, fontWeight: '600' as const },
  heading3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1 },
  mono: { fontSize: 13, fontWeight: '400' as const, fontFamily: 'monospace' },
};

export const Shadow = {
  green: {
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gold: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
};
