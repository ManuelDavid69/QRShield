import type { ConfirmOptions } from "./dialog";

// Alert.alert ne fait rien sur le web : version utilisée par les tests E2E dans le navigateur
export function confirmDialog({ title, message, onConfirm }: ConfirmOptions): void {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}

export function notify(title: string, message: string): void {
  window.alert(`${title}\n\n${message}`);
}
