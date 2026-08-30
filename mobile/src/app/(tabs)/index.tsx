import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";

import PermissionRequest from "@/components/PermissionRequest";
import ScanFrame from "@/components/ScanFrame";
import { colors } from "@/constants/colors";
import { getQrPayload } from "@/utils/scanResult";
import { t } from "@/i18n";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const isFocused = useIsFocused();
  // La caméra émet plusieurs détections par seconde pour un même code.
  const locked = useRef(false);

  useFocusEffect(
    useCallback(() => {
      locked.current = false;
      return () => {
        locked.current = true;
        setTorch(false);
      };
    }, []),
  );

  const handleScan = useCallback((result: BarcodeScanningResult) => {
    if (locked.current) return;
    locked.current = true;
    router.push({ pathname: "/result", params: { data: getQrPayload(result) } });
  }, []);

  if (permission === null) {
    return <View style={styles.loading} />;
  }

  if (!permission.granted) {
    return <PermissionRequest canAskAgain={permission.canAskAgain} onRequest={requestPermission} />;
  }

  return (
    <View style={styles.container}>
      {/* Les onglets restent montés : hors focus, ce réglage s'appliquerait aux autres écrans */}
      {isFocused ? <StatusBar style="light" /> : null}
      {/* La prop active est ignorée sur Android : la caméra et la lampe restaient allumées en
          arrière-plan. Retirer le composant ferme vraiment la caméra quand l'écran est masqué. */}
      {isFocused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleScan}
        />
      ) : null}
      <ScanFrame />
      <SafeAreaView style={styles.overlay}>
        <Text style={styles.title}>QRShield</Text>
        <Pressable
          style={[styles.torchButton, torch ? styles.torchButtonOn : null]}
          onPress={() => setTorch((previous) => !previous)}
        >
          <Text style={[styles.torchLabel, torch ? styles.torchLabelOn : null]}>{t.scanner.torch}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.scannerBackground,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.scannerBackground,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 28,
    pointerEvents: "box-none",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 12,
  },
  torchButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.55)",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  torchButtonOn: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  torchLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  torchLabelOn: {
    color: colors.scannerBackground,
  },
});
