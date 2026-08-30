import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { t } from "@/i18n";

interface PermissionRequestProps {
  canAskAgain: boolean;
  onRequest: () => void;
}

export default function PermissionRequest({ canAskAgain, onRequest }: PermissionRequestProps) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t.scanner.permissionTitle}</Text>
      <Text style={styles.description}>
        {t.scanner.permissionText}
      </Text>

      {canAskAgain ? (
        <Pressable style={styles.button} onPress={onRequest}>
          <Text style={styles.buttonText}>{t.scanner.permissionAllow}</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.description}>
            {t.scanner.permissionDenied}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              void Linking.openSettings();
            }}
          >
            <Text style={styles.buttonText}>{t.scanner.openSettings}</Text>
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
