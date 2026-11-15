import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, InlineError } from '@/components/ui';
import { findFoodByBarcode } from '@/data/repository';
import { draftRoute } from '@/lib/draftRoute';
import { lookupBarcode, NOT_ANSWERING, OpenFoodFactsError } from '@/lib/openFoodFacts';
import { useTheme } from '@/theme/settings';

type Scan =
  | { status: 'scanning' }
  | { status: 'looking' }
  | { status: 'not-found'; barcode: string }
  | { status: 'error'; barcode: string; message: string };

// Scan a barcode (issue #17): My foods first, offline, then Open Food Facts (ADR 0001).
// A found product continues like a search result; an unknown one offers Create a food,
// which keeps the barcode so the next scan finds the user's own copy.
export default function ScanFoodScreen() {
  const db = useSQLiteContext();
  const { styles, colors } = useTheme();
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scan, setScan] = useState<Scan>({ status: 'scanning' });

  useEffect(() => {
    if (permission?.status === 'undetermined') requestPermission();
  }, [permission?.status, requestPermission]);

  async function scanned({ data }: BarcodeScanningResult) {
    const barcode = data.trim();
    setScan({ status: 'looking' }); // also stops further scans while this one is handled
    try {
      const mine = await findFoodByBarcode(db, barcode).catch(() => null); // a local read failure just falls through to online
      if (mine) return router.replace({ pathname: '/food-amount', params: { date, meal, foodId: mine.id } });
      const draft = await lookupBarcode(barcode);
      if (!draft) return setScan({ status: 'not-found', barcode });
      router.replace(await draftRoute(db, draft, date, meal));
    } catch (e) {
      setScan({ status: 'error', barcode, message: e instanceof OpenFoodFactsError ? e.message : NOT_ANSWERING });
    }
  }

  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.muted}>
          {permission.canAskAgain
            ? 'Scanning needs the camera.'
            : "Camera access is off, so scanning can't work. Search still does, or allow the camera in your phone's settings."}
        </Text>
        {permission.canAskAgain ? <Button label="Allow camera" icon="camera-outline" onPress={requestPermission} /> : null}
        <Button label="Back to search" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={scan.status === 'scanning' ? scanned : undefined}
      />
      <View style={styles.content}>
        {scan.status === 'scanning' ? <Text style={styles.muted}>Point the camera at a barcode.</Text> : null}
        {scan.status === 'looking' ? <ActivityIndicator color={colors.accent} /> : null}
        {scan.status === 'not-found' ? <Text style={styles.muted}>This barcode isn&apos;t in Open Food Facts.</Text> : null}
        {scan.status === 'error' ? <InlineError>{scan.message}</InlineError> : null}
        {/* Offline or not answering, the user can still log it by hand under the scanned barcode. */}
        {scan.status === 'not-found' || scan.status === 'error' ? (
          <>
            <Button
              label="Create a food"
              icon="add"
              variant="primary"
              onPress={() => router.replace({ pathname: '/food-form', params: { date, meal, barcode: scan.barcode } })}
            />
            <Button label="Scan again" icon="barcode-outline" onPress={() => setScan({ status: 'scanning' })} />
          </>
        ) : null}
      </View>
    </View>
  );
}
