"use client";

import { useEffect, useRef, useCallback } from "react";
import { getAuthToken } from "@/lib/api";
import { getWsBase } from "@/lib/runtime-config";
import { useTeamStore } from "@/lib/store";
import type { StreamEvent, StreamEventType } from "@/lib/chat-types";
import { makeOptimisticUserInput } from "@/lib/chat-reducer";

// Re-exports para não quebrar consumidores antigos (AgentView, ChatTimeline).
export type { StreamEvent, StreamEventType } from "@/lib/chat-types";

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

let _eventCounter = 0;
function nextId() {
  return `e${++_eventCounter}-${Date.now()}`;
}

/**
 * Normaliza o campo `text` do evento conforme o tipo.
 *
 * Extraído do inline anterior para legibilidade e reuso em testes.
 */
function normalizeText(e: RawEvent): string {
  switch (e.type) {
    case "user_input":
    case "claude_text":
    case "tool_result":
    case "system":
      return e.content ?? "";
    case "thinking":
      return e.label
        ? e.duration
          ? `${e.label} (${e.duration})`
          : e.label
        : "thinking";
    case "tool_call":
      return e.name ?? "";
    case "interactive_menu":
      return e.title ?? "Selecione uma opção";
  }
}

/**
 * Hook que mantém a timeline de chat de UMA session tmux.
 *
 * Responsabilidades:
 *   - Abrir WebSocket e subscribir à session.
 *   - Reconectar com `clearTimeout` para não acumular reconexões zumbi.
 *   - Despachar eventos recebidos para o store Zustand (dedup lá).
 *   - Expor `events`, `clear`, `appendLocal` para o componente.
 *
 * **Onda 1** — estado migrado para `useTeamStore.chatBySession` (cache
 * por session + dedup centralizado).
 */
export function useMessageStream(session: string) {
  const chatState = useTeamStore((s) => s.chatBySession[session]);
  const upsertChatEvents = useTeamStore((s) => s.upsertChatEvents);
  const clearChatSession = useTeamStore((s) => s.clearChatSession);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const events = chatState?.events ?? [];

  const clear = useCallback(() => {
    clearChatSession(session);
  }, [clearChatSession, session]);

  /**
   * Acrescenta um evento localmente (feedback otimista).
   * Para `user_input`, já marca `optimistic: true` + `clientTs` — o reducer
   * cuida de reconciliar quando o eco chega do servidor.
   */
  const appendLocal = useCallback(
    (type: StreamEventType, text: string, extras?: Partial<StreamEvent>) => {
      const clientTs = Date.now();
      const ev: StreamEvent =
        type === "user_input"
          ? makeOptimisticUserInput(nextId(), text, clientTs)
          : {
              id: nextId(),
              type,
              text,
              timestamp: clientTs,
              ...extras,
            };
      // Permite override via `extras` (ex: system message com metadados).
      const merged = { ...ev, ...extras };
      upsertChatEvents(session, [merged]);
    },
    [session, upsertChatEvents]
  );

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function connect() {
      let token = "";
      try {
        token = await getAuthToken();
      } catch {
        /* sem token */
      }
      if (cancelled) return;

      const WS_URL = getWsBase();
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
            text: normalizeText(e),
            name: e.name,
            args: e.args,
            toolId: e.id,
            title: e.title,
            options: e.options,
            timestamp: now,
          }));

          upsertChatEvents(session, mapped);
        } catch {
          // ignora frames não-JSON
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        // Mata timer anterior se existir — evita empilhar reconexões.
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!cancelled) void connect();
        }, 2000);
      };
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
    };
  }, [session, upsertChatEvents]);

  return { events, clear, appendLocal };
}
