import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { KeyboardAwareScroll } from '@/components/KeyboardAwareScroll';
import { TargetsCard } from '@/components/TargetsCard';
import { Button, Chevron, InlineError, ListRow, PageHeader, Segmented } from '@/components/ui';
import { getDataSummary } from '@/data/repository';
import { formatClock, MAX_REST_SECONDS, MIN_REST_SECONDS, stepRest } from '@/domain/restTimer';
import { backUp, exportCsv, pickBackup, restoreFrom } from '@/lib/backup';
import { confirmAsync } from '@/lib/dialogs';
import { formatDateLong, formatNumber, formatWeight, localDateString } from '@/lib/format';
import { useRestTimer } from '@/lib/restTimer';
import { useFocusData } from '@/lib/useFocusData';
import { useSettings, useTheme } from '@/theme/settings';

// More: the link to History (3.12), daily nutrition Targets and My foods, settings for theme and weight unit (both
// apply immediately and are saved), and what is stored on this phone.
export default function MoreScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { theme, setTheme, unit, setUnit, restSeconds, setRestSeconds, reloadSettings } = useSettings();
  const { data: summary, reload } = useFocusData(() => getDataSummary(db), [db]);
  const rest = useRestTimer();
  const { alertsAllowed } = rest;
  const [dataError, setDataError] = useState<string | null>(null);
  // One backup, export or restore at a time: the ref stops a fast second tap, the state greys the buttons.
  const busy = useRef(false);
  const [working, setWorking] = useState(false);

  async function guarded(action: () => Promise<void>, failure: string) {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    setDataError(null);
    try {
      await action();
    } catch (e) {
      console.warn(e);
      setDataError(failure);
    }
    busy.current = false;
    setWorking(false);
  }

  const onBackUp = () =>
    guarded(async () => {
      await backUp(db);
      await reload();
    }, 'Could not back up. Try again.');

  const onExport = () => guarded(() => exportCsv(db, unit), 'Could not export. Try again.');

  const onRestore = () =>
    guarded(async () => {
      const picked = await pickBackup();
      if (!picked) return;
      if ('problem' in picked) return setDataError(picked.problem);
      const when = picked.backupDate ? formatDateLong(localDateString(new Date(picked.backupDate))) : 'an unknown date';
      const ok = await confirmAsync(
        'Restore from backup?',
        `Replace everything on this phone with the backup from ${when}? This includes any workout in progress and can't be undone.`,
        'Restore',
        true,
      );
      if (!ok) {
        await picked.backup.closeAsync();
        return;
      }
      await restoreFrom(picked.backup, db);
      await reloadSettings();
      // Whatever was running belongs to data that is gone now.
      rest.skip();
      rest.dismiss();
      router.replace('/workouts');
    }, 'Could not restore. Nothing was changed.');

  const stat = (label: string, value: number | undefined) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.title, styles.number]}>{value === undefined ? '—' : formatNumber(value)}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <PageHeader title="More" subtitle="History, settings and your data" />
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        <ListRow
          title="History"
          subtitle="Your recent workouts"
          right={<Chevron />}
          onPress={() => router.push('/more/history')}
        />
        <Text style={styles.sectionTitle}>Targets</Text>
        <TargetsCard />
        <ListRow title="My foods" subtitle="Edit or delete your saved foods" right={<Chevron />} onPress={() => router.push('/more/foods')} />

        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyStrong}>Theme</Text>
              <Text style={styles.small}>Saved on this phone</Text>
            </View>
            <Segmented
              accessibilityLabel="Theme"
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Units</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyStrong}>Weight</Text>
              {/* Shows what the setting produces, using one fixed example in the chosen unit first. */}
              <Text style={[styles.small, styles.number]}>
                {unit === 'kg' ? `60 kg = ${formatWeight(60, 'lb')} lb` : `${formatWeight(60, 'lb')} lb = 60 kg`}
              </Text>
            </View>
            <Segmented
              accessibilityLabel="Weight unit"
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
              value={unit}
              onChange={setUnit}
            />
          </View>
          <Text style={styles.muted}>Switching changes how every weight is shown, past workouts included. Logged data stays as it is.</Text>
        </View>

        <Text style={styles.sectionTitle}>Rest timer</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bodyStrong}>Rest between sets</Text>
              <Text style={styles.small}>Saved on this phone</Text>
            </View>
            <Button
              label="−"
              compact
              accessibilityLabel="Shorter rest"
              disabled={restSeconds <= MIN_REST_SECONDS}
              onPress={() => setRestSeconds(stepRest(restSeconds, -1))}
            />
            <Text style={[styles.title, styles.number, { minWidth: 52, textAlign: 'center' }]}>{formatClock(restSeconds)}</Text>
            <Button
              label="+"
              compact
              accessibilityLabel="Longer rest"
              disabled={restSeconds >= MAX_REST_SECONDS}
              onPress={() => setRestSeconds(stepRest(restSeconds, 1))}
            />
          </View>
          {alertsAllowed === false ? (
            <Text style={styles.small}>Notifications are off, so the rest timer can only vibrate while the app is open.</Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Your data</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {stat('Days', summary?.days)}
            {stat('Exercises', summary?.exercises)}
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {stat('Workouts', summary?.workouts)}
            {stat('Sets logged', summary?.sets)}
          </View>
          <Text style={styles.small}>Stored only on this phone. Nothing is uploaded.</Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.small}>Backup and export work in the phone app.</Text>
          ) : (
            <>
              <Text style={styles.small}>
                {summary?.lastBackup
                  ? `Last backup ${formatDateLong(localDateString(new Date(summary.lastBackup)))}`
                  : 'No backup yet'}
              </Text>
              <View style={styles.buttonRow}>
                <Button label="Back up" icon="cloud-upload-outline" onPress={onBackUp} disabled={working} style={{ flex: 1 }} />
                <Button label="Export CSV" icon="document-text-outline" onPress={onExport} disabled={working} style={{ flex: 1 }} />
              </View>
              <Button label="Restore from backup" icon="refresh" variant="link" onPress={onRestore} disabled={working} />
              {dataError ? <InlineError>{dataError}</InlineError> : null}
            </>
          )}
        </View>
      </KeyboardAwareScroll>
    </View>
  );
}
