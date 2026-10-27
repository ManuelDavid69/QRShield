import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";

interface PermissionRequestProps {
  canAskAgain: boolean;
  onRequest: () => void;
}

export default function PermissionRequest({ canAskAgain, onRequest }: PermissionRequestProps) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Accès à la caméra</Text>
      <Text style={styles.description}>
        QRShield a besoin de la caméra pour lire les QR codes. Aucune image n&apos;est enregistrée.
      </Text>

      {canAskAgain ? (
        <Pressable style={styles.button} onPress={onRequest}>
          <Text style={styles.buttonText}>Autoriser la caméra</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.description}>
            L&apos;accès a été refusé. Vous pouvez l&apos;activer dans les réglages du téléphone.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              void Linking.openSettings();
            }}
          >
            <Text style={styles.buttonText}>Ouvrir les réglages</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
});
