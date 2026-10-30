import { StyleSheet } from 'react-native';

import type { Palette } from '@/theme/palette';

/**
 * Shared styles, rebuilt from the active palette. Layout follows the
 * reference screenshots: large bold page titles, rounded cards on a darker
 * background, and pill-shaped toggles.
 */
export function makeStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, gap: 10 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: c.background },

    eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, color: c.muted, textTransform: 'uppercase' },
    largeTitle: { fontSize: 32, fontWeight: '800', color: c.text },
    sectionTitle: { fontSize: 19, fontWeight: '700', color: c.text, marginTop: 6 },
    title: { fontSize: 20, fontWeight: '700', color: c.text },
    body: { fontSize: 15, color: c.text },
    muted: { fontSize: 14, color: c.muted },

    card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 8 },

    button: {
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
    },
    buttonCompact: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
    buttonPrimary: { backgroundColor: c.primary },
    buttonDanger: { backgroundColor: c.danger },
    buttonLink: { backgroundColor: 'transparent', paddingHorizontal: 4 },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { fontSize: 15, fontWeight: '600', color: c.text },
    buttonTextOnColor: { color: c.onPrimary },
    buttonTextLink: { color: c.primary },
    pressed: { opacity: 0.7 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: c.surface,
      gap: 10,
    },
    rowText: { flex: 1, gap: 3 },
    rowTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    rowSubtitle: { fontSize: 13, color: c.muted },

    field: {
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    fieldInvalid: { borderColor: c.danger },

    errorText: { fontSize: 15, color: c.text, textAlign: 'center' },
    empty: { fontSize: 15, color: c.muted, paddingVertical: 12 },
    inlineError: { fontSize: 13, color: c.danger },
    buttonRow: { flexDirection: 'row', gap: 8 },

    segmented: { flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 999, padding: 3, alignSelf: 'flex-start' },
    segment: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 999 },
    segmentSelected: { backgroundColor: c.pill },
    segmentText: { fontSize: 14, fontWeight: '600', color: c.muted },
    segmentTextSelected: { color: c.onPill },
  });
}
