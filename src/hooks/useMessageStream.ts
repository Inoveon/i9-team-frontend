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
  text?: string;
  name?: string;
  args?: string;
  toolId?: string;
  content?: string;
  title?: string;
  options?: Array<{ index: number; label: string }>;
  timestamp: number;
}

interface MessageStreamMsg {
  type: "message_stream";
  session: string;
  events: Array<{
    type: StreamEventType;
    text?: string;
    name?: string;
    args?: string;
    id?: string;
    content?: string;
    title?: string;
    options?: Array<{ index: number; label: string }>;
  }>;
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
          const mapped: StreamEvent[] = msg.events.map((e) => ({
            id: nextId(),
            type: e.type,
            text: e.text,
            name: e.name,
            args: e.args,
            toolId: e.id,
            content: e.content,
            title: e.title,
            options: e.options,
            timestamp: now,
          }));

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
