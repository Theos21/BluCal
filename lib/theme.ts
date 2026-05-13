import { useColorScheme } from 'react-native';

export const light = {
  mode: 'light' as const,
  bg:           '#F4F4F6',
  surface:      '#FFFFFF',
  surface2:     '#EEEEF1',
  surface3:     '#E5E5E9',
  separator:    'rgba(60,60,67,0.14)',
  hairline:     'rgba(60,60,67,0.22)',
  scrim:        'rgba(0,0,0,0.36)',
  text:         '#0B0B0F',
  textSec:      '#5C5C63',
  textTer:      '#9A9AA0',
  textOnPrim:   '#FFFFFF',
  primary:      '#185FA5',
  primaryPress: '#134B82',
  primarySoft:  'rgba(24,95,165,0.10)',
  teal:         '#0F6E56',
  tealSoft:     'rgba(15,110,86,0.10)',
  danger:       '#D8362F',
  dangerSoft:   'rgba(216,54,47,0.10)',
  warn:         '#C8801C',
  warnSoft:     'rgba(200,128,28,0.14)',
  success:      '#1F8E54',
  successSoft:  'rgba(31,142,84,0.12)',
  protein:      '#185FA5',
  carbs:        '#C8801C',
  fat:          '#0F6E56',
};

export const dark = {
  mode: 'dark' as const,
  bg:           '#18191D',
  surface:      '#23262B',
  surface2:     '#2D3035',
  surface3:     '#383B42',
  separator:    'rgba(170,175,185,0.16)',
  hairline:     'rgba(170,175,185,0.24)',
  scrim:        'rgba(0,0,0,0.58)',
  text:         '#F2F3F5',
  textSec:      '#A2A6AE',
  textTer:      '#6E727A',
  textOnPrim:   '#FFFFFF',
  primary:      '#4F95DC',
  primaryPress: '#6FAAE5',
  primarySoft:  'rgba(79,149,220,0.18)',
  teal:         '#3DB593',
  tealSoft:     'rgba(61,181,147,0.18)',
  danger:       '#FF6058',
  dangerSoft:   'rgba(255,96,88,0.18)',
  warn:         '#F0A040',
  warnSoft:     'rgba(240,160,64,0.18)',
  success:      '#3DC57A',
  successSoft:  'rgba(61,197,122,0.18)',
  protein:      '#4F95DC',
  carbs:        '#F0A040',
  fat:          '#3DB593',
};

export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: 0.37 },
  title1:     { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: 0.36 },
  title2:     { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: 0.35 },
  title3:     { fontSize: 20, lineHeight: 25, fontWeight: '600' as const, letterSpacing: 0.38 },
  headline:   { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.41 },
  body:       { fontSize: 17, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.41 },
  callout:    { fontSize: 16, lineHeight: 21, fontWeight: '400' as const, letterSpacing: -0.32 },
  subhead:    { fontSize: 15, lineHeight: 20, fontWeight: '400' as const, letterSpacing: -0.24 },
  subheadEm:  { fontSize: 15, lineHeight: 20, fontWeight: '600' as const, letterSpacing: -0.24 },
  footnote:   { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption1:   { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0 },
  caption2:   { fontSize: 11, lineHeight: 13, fontWeight: '500' as const, letterSpacing: 0.07 },
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export type Theme = typeof light | typeof dark;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
