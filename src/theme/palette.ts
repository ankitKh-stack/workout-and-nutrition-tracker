// Colour tokens for the light and dark themes. The dark palette follows the
// reference screenshots: near-black background, raised charcoal cards, white
// text, and blue / orange / yellow / green accents.

export type ThemeName = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  success: string;
  blue: string;
  orange: string;
  yellow: string;
  green: string;
  /** Selected segment of a pill toggle. */
  pill: string;
  onPill: string;
  /** Calendar: neutral "no workout" square, then zero volume and levels 1–4, weakest to strongest. */
  shades: { none: string; zero: string; 1: string; 2: string; 3: string; 4: string };
};

export const palettes: Record<ThemeName, Palette> = {
  light: {
    background: '#f4f4f6',
    surface: '#ffffff',
    surfaceAlt: '#ebebef',
    border: '#e0e0e6',
    text: '#111114',
    muted: '#6b6b74',
    primary: '#2f6fe0',
    onPrimary: '#ffffff',
    danger: '#e0553a',
    success: '#1f9d64',
    blue: '#3b7ff0',
    orange: '#ec6a48',
    yellow: '#e5ad1f',
    green: '#22a86d',
    pill: '#111114',
    onPill: '#ffffff',
    // Darker means more progress, as in the spec.
    shades: { none: '#e4e4e9', zero: '#d3efe1', 1: '#9edbbb', 2: '#55bf89', 3: '#2a9c62', 4: '#156b41' },
  },
  dark: {
    background: '#161618',
    surface: '#252528',
    surfaceAlt: '#303034',
    border: '#38383d',
    text: '#f5f5f7',
    muted: '#9c9ca3',
    primary: '#4c8df6',
    onPrimary: '#ffffff',
    danger: '#ef6b4a',
    success: '#2fb67c',
    blue: '#4c8df6',
    orange: '#ef6b4a',
    yellow: '#f4c443',
    green: '#2fb67c',
    pill: '#ffffff',
    onPill: '#111114',
    // On a dark background the strongest level is the most intense green.
    shades: { none: '#2c2c30', zero: '#2c4f3e', 1: '#2f7a52', 2: '#36a466', 3: '#4cc887', 4: '#9df0c4' },
  },
};
