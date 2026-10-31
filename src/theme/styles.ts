import { StyleSheet } from 'react-native';

import { fonts, type Palette } from '@/theme/palette';

// Type scale: 12 / 14 / 16 / 20 / 28. Weights 400, 500 and 600 only.
// Numbers use tabular figures so digits line up and do not jitter as they update.
const tabular = { fontVariant: ['tabular-nums' as const] };

/**
 * Shared styles, rebuilt from the active palette. Surfaces are separated by a
 * lightness step, never a border or a shadow; radius is soft (20 on cards,
 * 12 on nested fields, full pills on controls).
 */
export function makeStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: c.background },

    pageTitle: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4, color: c.text },
    pageSubtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.muted },
    sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.text, marginTop: 8 },
    title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: c.text },
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.text },
    bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: c.text },
    muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.muted },
    small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: c.faint },
    label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: c.faint },
    number: { ...tabular },

    card: { backgroundColor: c.surface, borderRadius: 20, padding: 16, gap: 10 },

    button: {
      minHeight: 44,
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: c.raised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonCompact: { minHeight: 36, paddingVertical: 7, paddingHorizontal: 14 },
    buttonPrimary: { backgroundColor: c.primary },
    buttonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.negative },
    buttonLink: { backgroundColor: 'transparent', paddingHorizontal: 6, minHeight: 36 },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: c.text },
    buttonTextPrimary: { color: c.onPrimary },
    buttonTextDanger: { color: c.negative },
    pressed: { opacity: 0.65 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: c.surface,
      gap: 12,
    },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: c.text },
    rowSubtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: c.muted },

    field: {
      minHeight: 44,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontFamily: fonts.medium,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.raised,
      borderWidth: 1,
      borderColor: 'transparent',
      ...tabular,
    },
    fieldInvalid: { borderColor: c.negative },

    errorText: { fontFamily: fonts.regular, fontSize: 15, color: c.text, textAlign: 'center' },
    empty: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.muted, paddingVertical: 8 },
    inlineError: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: c.negative },
    buttonRow: { flexDirection: 'row', gap: 8 },

    segmented: { flexDirection: 'row', backgroundColor: c.raised, borderRadius: 999, padding: 3, alignSelf: 'flex-start' },
    segment: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999 },
    segmentSelected: { backgroundColor: c.primary },
    segmentText: { fontFamily: fonts.medium, fontSize: 14, color: c.muted },
    segmentTextSelected: { color: c.onPrimary },
  });
}
