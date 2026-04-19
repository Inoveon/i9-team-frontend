"use client";

import { useEffect, useRef } from "react";
import type { StreamEvent } from "@/hooks/useMessageStream";
import { UserBubble } from "./UserBubble";
import { ClaudeBubble } from "./ClaudeBubble";
import { ToolCallCollapsible } from "./ToolCallCollapsible";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { SystemBadge } from "./SystemBadge";

interface ChatTimelineProps {
  events: StreamEvent[];
  height?: number;
}

export function ChatTimeline({ events, height = 440 }: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ao fundo quando chegam novos eventos
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  // Mapeia tool_result de volta para o tool_call pelo toolId
  // tool_result.text = conteúdo normalizado pelo hook (campo content do backend)
  const resultMap: Record<string, string> = {};
  for (const ev of events) {
    if (ev.type === "tool_result" && ev.toolId && ev.text) {
      resultMap[ev.toolId] = ev.text;
    }
  }

  return (
    <div
      style={{
        height,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(0,212,255,0.15) transparent",
      }}
    >
      {events.length === 0 && (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.15)",
          fontSize: 12,
          fontFamily: "monospace",
        }}>
          aguardando mensagens…
        </div>
      )}

      {events.map((ev) => {
        switch (ev.type) {
          case "user_input":
            return <UserBubble key={ev.id} text={ev.text ?? ""} />;

          case "claude_text":
            return <ClaudeBubble key={ev.id} text={ev.text ?? ""} />;

          case "tool_call":
            return (
              <ToolCallCollapsible
                key={ev.id}
                name={ev.name ?? "Tool"}
                args={ev.args}
                result={ev.toolId ? resultMap[ev.toolId] : undefined}
              />
            );

          case "tool_result":
            // Renderizado dentro do ToolCallCollapsible — não exibe standalone
            return null;

          case "thinking":
            return <ThinkingIndicator key={ev.id} text={ev.text} />;

          case "system":
            return <SystemBadge key={ev.id} text={ev.text ?? ""} />;

          case "interactive_menu":
            return (
              <SystemBadge
                key={ev.id}
                text={`menu: ${ev.text || "selecione uma opção"}${ev.options?.length ? ` (${ev.options.length} opções)` : ""}`}
              />
            );

          default:
            return null;
        }
      })}

      <div ref={bottomRef} />
    </div>
  );
}
