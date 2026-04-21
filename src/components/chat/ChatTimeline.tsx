"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { StreamEvent } from "@/hooks/useMessageStream";
import { UserBubble } from "./UserBubble";
import { ClaudeBubble } from "./ClaudeBubble";
import { ToolCallCollapsible } from "./ToolCallCollapsible";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { SystemBadge } from "./SystemBadge";

interface ChatTimelineProps {
  events: StreamEvent[];
  /**
   * Altura fixa em px. Se omitido → modo **flex** (ocupa o espaço disponível
   * do container pai, que precisa ser `display:flex flexDirection:column`).
   */
  height?: number;

  /**
   * Notifica o pai toda vez que o estado "usuário está no fim" muda.
   * Usado pelo AgentView para decidir exibir a pill de novas mensagens.
   */
  onBottomChange?: (atBottom: boolean) => void;
}

/**
 * Interface imperativa do ChatTimeline — permite ao pai fazer scroll
 * até o fim programaticamente (ex: clicar na pill).
 */
export interface ChatTimelineHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export const ChatTimeline = forwardRef<ChatTimelineHandle, ChatTimelineProps>(
  function ChatTimeline({ events, height, onBottomChange }, ref) {
    const isFlex = height === undefined;

    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Callback ref: re-avalia o IntersectionObserver quando o nó do
    // container aparece/muda (ex: remount ao alternar abas Chat/Terminal).
    // useRef NÃO triggera re-render — callback ref + useState sim.
    const containerRefCb = useCallback((node: HTMLDivElement | null) => {
      setContainer(node);
    }, []);

    // Observa a visibilidade do sentinela `bottomRef` dentro do container.
    // Quando o sentinela está visível → usuário está no fim da timeline.
    useEffect(() => {
      if (!container || !bottomRef.current) return;
      const sentinel = bottomRef.current;
      const io = new IntersectionObserver(
        ([entry]) => {
          setIsAtBottom(entry.isIntersecting);
        },
        { root: container, threshold: 0.1 }
      );
      io.observe(sentinel);
      return () => io.disconnect();
    }, [container]);

    // Notifica o pai (AgentView) sempre que `isAtBottom` mudar.
    useEffect(() => {
      onBottomChange?.(isAtBottom);
    }, [isAtBottom, onBottomChange]);

    // Auto-scroll condicional — só segue o fundo quando o usuário já está nele.
    useEffect(() => {
      if (!isAtBottom) return;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [events.length, isAtBottom]);

    // Ref imperativa — usada pelo AgentView ao clicar na pill
    useImperativeHandle(
      ref,
      () => ({
        scrollToBottom: (behavior: ScrollBehavior = "smooth") => {
          bottomRef.current?.scrollIntoView({ behavior });
        },
      }),
      []
    );

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
        ref={containerRefCb}
        style={{
          // modo flex: ocupa o espaço do pai; modo fixo: altura em px
          height: isFlex ? undefined : height,
          flex: isFlex ? 1 : undefined,
          minHeight: 0,
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
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.15)",
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
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
                  text={`menu: ${ev.text || "selecione uma opção"}${
                    ev.options?.length ? ` (${ev.options.length} opções)` : ""
                  }`}
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
);
