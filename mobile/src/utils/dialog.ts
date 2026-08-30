import { Alert } from "react-native";
import { t } from "@/i18n";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function confirmDialog({ title, message, confirmLabel, destructive, onConfirm }: ConfirmOptions): void {
  Alert.alert(title, message, [
    { text: t.common.cancel, style: "cancel" },
    { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string): void {
  Alert.alert(title, message);
}
