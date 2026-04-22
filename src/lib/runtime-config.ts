/**
 * Resolve base URLs de API e WebSocket em runtime, a partir do hostname atual do browser.
 *
 * Por que runtime e não const top-level?
 *   Se o módulo for importado em Server Component/SSR, `window` é undefined e
 *   o valor cacheia "http://localhost:4020". Chamando em runtime (dentro da função/hook)
 *   a resolução ocorre sempre no browser com o hostname correto.
 *
 * Prioridade:
 *   1. NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL (override explícito via env)
 *   2. window.location.hostname + porta 4020 (mesmo bundle serve local e remoto)
 *   3. "http://localhost:4020" / "ws://localhost:4020" (fallback p/ SSR)
 */

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") return "http://localhost:4020";
  return `${window.location.protocol}//${window.location.hostname}:4020`;
}

export function getWsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === "undefined") return "ws://localhost:4020";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:4020`;
}
