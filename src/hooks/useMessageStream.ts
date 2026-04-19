"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "@/lib/api";

export type StreamEventType =
  | "user_input"
  | "claude_text"
  | "tool_call"
  | "tool_result"
  | "thinking"
  | "system"
  | "interactive_menu";

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  /** Texto normalizado — preenchido pelo hook independente do campo original */
  text: string;
  name?: string;
  args?: string;
  toolId?: string;
  title?: string;
  options?: string[];
  timestamp: number;
}

/** Formato real dos eventos emitidos pelo backend (parseMessageStream.ts) */
interface RawEvent {
  type: StreamEventType;
  // user_input | claude_text | tool_result | system
  content?: string;
  // thinking
  label?: string;
  duration?: string;
  // tool_call
  name?: string;
  args?: string;
  id?: string;
  // interactive_menu
  title?: string;
  options?: string[];
}

interface MessageStreamMsg {
  type: "message_stream";
  session: string;
  events: RawEvent[];
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4020";

let _eventCounter = 0;
function nextId() {
  return `e${++_eventCounter}-${Date.now()}`;
}

export function useMessageStream(session: string) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function connect() {
      let token = "";
      try { token = await getAuthToken(); } catch { /* sem token */ }
      const url = token
        ? `${WS_URL}/ws?token=${encodeURIComponent(token)}`
        : `${WS_URL}/ws`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "subscribe", session }));
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(ev.data as string) as MessageStreamMsg;
          if (msg.type !== "message_stream" || msg.session !== session) return;
          if (!Array.isArray(msg.events) || msg.events.length === 0) return;

          const now = Date.now();
          const mapped: StreamEvent[] = msg.events.map((e) => {
            // Normaliza o campo de texto de acordo com o tipo do evento
            let text = "";
            switch (e.type) {
              case "user_input":
              case "claude_text":
              case "tool_result":
              case "system":
                text = e.content ?? "";
                break;
              case "thinking":
                text = e.label ? (e.duration ? `${e.label} (${e.duration})` : e.label) : "thinking";
                break;
              case "tool_call":
                text = e.name ?? "";
                break;
              case "interactive_menu":
                text = e.title ?? "Selecione uma opção";
                break;
            }

            return {
              id: nextId(),
              type: e.type,
              text,
              name: e.name,
              args: e.args,
              toolId: e.id,
              title: e.title,
              options: e.options,
              timestamp: now,
            };
          });

          console.log("[useMessageStream] eventos recebidos:", mapped.map(e => ({ type: e.type, text: e.text?.slice(0, 50) })));

          setEvents((prev) => [...prev, ...mapped]);
        } catch {
          // ignora frames não-JSON
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          // reconecta após 2s
          setTimeout(() => { if (!cancelled) void connect(); }, 2000);
        }
      };
    }

    void connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [session]);

  return { events, clear };
}
