import { getWsBase } from "@/lib/runtime-config";

export type WSMessageHandler = (data: string) => void;

export function createWebSocket(
  sessionId: string,
  onMessage: WSMessageHandler,
  onClose?: () => void
): WebSocket {
  const WS_BASE = getWsBase();
  const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`);

  ws.onmessage = (event) => {
    onMessage(event.data as string);
  };

  ws.onerror = (err) => {
    console.error("[ws] error", err);
  };

  if (onClose) {
    ws.onclose = onClose;
  }

  return ws;
}
