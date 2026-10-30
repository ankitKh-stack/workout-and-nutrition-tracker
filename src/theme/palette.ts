// Colour tokens for the light and dark themes.
//
// Dark follows the "true-black flat" app style: a #000 ground, cards one
// lightness step up (#111), nested fields another step (#2a2a2a), no borders
// or shadows on cards, and colour only on data. The one data hue is a lime
// (sport), used for progress: the calendar shades and the in-progress mark.
// Buttons are never coloured; the primary action is an inverted pill.
// Light uses the same roles with the neutral light defaults.

export type ThemeName = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  /** Nested panels and input fields, one step above the surface. */
  raised: string;
  border: string;
  text: string;
  /** Secondary text. */
  muted: string;
  /** Meta and placeholders; still 4.5:1 on the surface. */
  faint: string;
  /** Fill of the one primary action (inverted: white on dark, near-black on light). */
  primary: string;
  onPrimary: string;
  /** The one data hue: progress. */
  accent: string;
  negative: string;
  /** Kind marks for intensifier rows, used only as a 3px edge and the row's label. */
  kinds: { drop: string; partial: string; superset: string };
  /** Calendar: neutral "no workout" square, then zero volume and levels 1–4, weakest to strongest. */
  shades: { none: string; zero: string; 1: string; 2: string; 3: string; 4: string };
};

export const palettes: Record<ThemeName, Palette> = {
  light: {
    background: '#f6f6f6',
    surface: '#ffffff',
    raised: '#f0f0f0',
    border: '#e8e8e8',
    text: '#111111',
    muted: '#5f6368',
    faint: '#6b6b6b',
    primary: '#1d1f20',
    onPrimary: '#ffffff',
    accent: '#4d7c0f',
    negative: '#c4242a',
    kinds: { drop: '#c2410c', partial: '#a16207', superset: '#1d64d8' },
    // Darker means more progress, as in the spec.
    shades: { none: '#ececec', zero: '#e4edcc', 1: '#c5e08a', 2: '#97c24a', 3: '#6b9a1f', 4: '#3f6212' },
  },
  dark: {
    background: '#000000',
    surface: '#111111',
    raised: '#2a2a2a',
    border: '#1a1a1a',
    text: '#ffffff',
    muted: '#b4b4b4',
    faint: '#949494',
    primary: '#ffffff',
    onPrimary: '#000000',
    accent: '#c6f24e',
    negative: '#e5566f',
    kinds: { drop: '#f08a5d', partial: '#e8c454', superset: '#6aa8f7' },
    // On a dark ground the strongest level is the brightest lime.
    shades: { none: '#222222', zero: '#2b3314', 1: '#4b5e1c', 2: '#7d9c2c', 3: '#a7cf3d', 4: '#c6f24e' },
  },
};

/** Inter, loaded in the root layout. Each weight is its own family so it renders the same on Android, iOS and web. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;
