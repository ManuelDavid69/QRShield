import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { ApiError, createScan, type Scan } from "@/services/api";
import { getScanPosition } from "@/services/location";
import { sanitizeForUpload, type ParsedQr } from "@/utils/qrContent";
import { t } from "@/i18n";

type AnalysisState =
  | { status: "loading" }
  | { status: "done"; scan: Scan }
  | { status: "error"; message: string };

export function useScanAnalysis(parsed: ParsedQr): { state: AnalysisState; retry: () => void } {
  const { token, signOut } = useAuth();
  const [state, setState] = useState<AnalysisState>({ status: "loading" });
  // Un seul envoi par scan, sinon il apparaîtrait en double dans l'historique
  const sent = useRef(false);

  const send = useCallback(async () => {
    if (token === null) return;
    setState({ status: "loading" });
    try {
      const scan = await createScan(token, sanitizeForUpload(parsed), await getScanPosition());
      setState({ status: "done", scan });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Token expiré : la garde de navigation renvoie vers la connexion
        await signOut();
        return;
      }
      const message = error instanceof ApiError ? error.message : t.result.failed;
      setState({ status: "error", message });
    }
  }, [parsed, token, signOut]);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void send();
  }, [send]);

  return { state, retry: send };
}
