"use client";

import { useCallback, useState } from "react";
import type { ToastItem, ToastKind } from "@/components/notes/NotesToast";

let _toastCounter = 0;

export interface PushToastOptions {
  title?: string;
  actions?: ToastItem["actions"];
  /** TTL em ms — default: 4s (ou 12s se houver actions) */
  ttl?: number;
}

export interface UseToastsApi {
  toasts: ToastItem[];
  pushToast: (kind: ToastKind, message: string, opts?: PushToastOptions) => void;
  dismissToast: (id: string) => void;
}

/**
 * useToasts — Hook compartilhado para exibir toasts.
 *
 * Extraído do `NotesPanel` (que usa esse mesmo padrão) para ser reutilizado
 * pela UX de anexos da Onda 5. Mantém o mesmo comportamento:
 *   - TTL default de 4s, 12s se houver `actions`.
 *   - Empilhamento no `ToastStack` via componente compartilhado.
 *
 * Uso:
 *   const { toasts, pushToast, dismissToast } = useToasts();
 *   pushToast("warning", "Arquivo muito grande");
 *   return <ToastStack toasts={toasts} onDismiss={dismissToast} />;
 */
export function useToasts(): UseToastsApi {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (kind: ToastKind, message: string, opts?: PushToastOptions) => {
      const id = `t${Date.now()}-${++_toastCounter}`;
      const item: ToastItem = {
        id,
        kind,
        message,
        title: opts?.title,
        actions: opts?.actions,
      };
      setToasts((prev) => [...prev, item]);
      const ttl = opts?.ttl ?? (opts?.actions ? 12_000 : 4_000);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
