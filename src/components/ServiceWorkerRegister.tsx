"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegister — Registra o `/sw.js` para habilitar PWA install +
 * cache de assets estáticos.
 *
 * Browser exige contexto seguro:
 *   - Em `localhost` / `127.0.0.1`: registra mesmo em HTTP (Chrome libera).
 *   - Em IP externo (ex: 10.0.10.17) sem HTTPS: NÃO registra (silenciosamente).
 *   - Em produção HTTPS: sempre registra.
 *
 * Não interfere com WebSocket nem com `/api/*` — o SW está configurado pra
 * deixá-los passar.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      console.log("[PWA] navigator.serviceWorker indisponível neste browser.");
      return;
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const isSecure = window.location.protocol === "https:";

    if (!isLocalhost && !isSecure) {
      // SW não pode registrar em HTTP fora de localhost — silenciosamente skip.
      console.log(
        "[PWA] SW skip: contexto não seguro (use HTTPS ou localhost).",
        window.location.host
      );
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[PWA] Service Worker registrado:", reg.scope);
        })
        .catch((err) => {
          console.error("[PWA] SW registration falhou:", err);
        });
    };

    // Aguarda window.load pra não competir com hidration / first paint.
    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
