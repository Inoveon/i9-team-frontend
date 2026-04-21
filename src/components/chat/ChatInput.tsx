"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";

/**
 * ChatInput — Input multilinha compartilhado por AgentView e AgentPanel.
 *
 * Comportamento (Onda 4):
 *   - `<textarea>` auto-crescendo de 1 até `maxRows` linhas (default 8).
 *   - `Enter` sozinho → quebra de linha (nativo do textarea).
 *   - `Shift+Enter` → quebra de linha (nativo).
 *   - `Ctrl+Enter` / `Cmd+Enter` → envia (padrão Slack/Discord/ChatGPT).
 *   - Guard de IME: ignora Enter durante composição de caracteres (acentos, chinês).
 *   - Foco volta ao campo após envio (manual `ref.focus()` no finally).
 *   - `fontSize: 16px` evita auto-zoom do iOS Safari.
 *
 * Fluxo de envio:
 *   1. Usuário digita, pressiona Ctrl+Enter ou clica Send.
 *   2. ChatInput seta `sending=true`, limpa o draft, chama `onSend(msg)`.
 *   3. Erros do pai (via throw em onSend) não limpam o draft de volta —
 *      padrão anterior do AgentView (limpar antes, mostrar system message).
 *   4. `sending=false` + refocus no finally.
 */

export interface ChatInputProps {
  /**
   * Chamado com a mensagem quando o usuário envia.
   * Pode ser async — o campo mostra "..." enquanto a promise resolve.
   * Se lançar, o draft não é restaurado (comportamento original preservado).
   */
  onSend: (message: string) => void | Promise<void>;

  /** Desabilita input + botão (além do estado interno `sending`) */
  disabled?: boolean;

  /** Placeholder do campo */
  placeholder?: string;

  /** Quantidade mínima de linhas (default: 1) */
  minRows?: number;

  /** Quantidade máxima de linhas antes de scroll interno (default: 8) */
  maxRows?: number;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Enviar mensagem ao agente...",
  minRows = 1,
  maxRows = 8,
}: ChatInputProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = !!draft.trim() && !sending && !disabled;

  const handleSend = useCallback(async () => {
    const msg = draft;
    if (!msg.trim() || sending || disabled) return;

    setSending(true);
    setDraft(""); // limpa imediatamente — UX fluida (comportamento herdado)

    try {
      await onSend(msg);
    } catch {
      // Feedback de erro fica com o pai (via appendLocal "system" etc).
      // Não restaurar draft — comportamento original do AgentView.
    } finally {
      setSending(false);
      // Devolve foco pro campo — textarea colapsa sozinho pois draft=""
      textareaRef.current?.focus();
    }
  }, [draft, sending, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME guard — evita envio durante composição de caracteres (acentos, kanji)
    if (e.nativeEvent.isComposing) return;

    // Ctrl+Enter / Cmd+Enter → envia
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
      return;
    }
    // Enter sozinho / Shift+Enter → quebra de linha (comportamento nativo)
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "8px 12px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "0 0 8px 8px",
        alignItems: "flex-end", // ancora o ❯ e o botão no bottom quando textarea cresce
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: "rgba(0,255,136,0.5)",
          fontFamily: "monospace",
          fontSize: 13,
          lineHeight: "32px",
          flexShrink: 0,
        }}
      >
        ❯
      </span>

      <TextareaAutosize
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending || disabled}
        placeholder={sending ? "enviando..." : placeholder}
        aria-label="Mensagem para o agente"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        minRows={minRows}
        maxRows={maxRows}
        title="Enter: nova linha · Ctrl/Cmd+Enter: enviar"
        style={{
          flex: 1,
          resize: "none",
          background: "transparent",
          border: "none",
          outline: "none",
          color: "#00ff88",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 16, // >=16px evita auto-zoom do iOS
          lineHeight: "1.4",
          caretColor: "#00d4ff",
          padding: "6px 0",
          minWidth: 0,
        }}
      />

      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={!canSend}
        aria-label="Enviar mensagem"
        title="Enviar (Ctrl/Cmd+Enter)"
        style={{
          padding: "6px 14px",
          borderRadius: 6,
          border: "1px solid rgba(0,255,136,0.4)",
          background: sending ? "rgba(0,255,136,0.05)" : "transparent",
          color: canSend ? "#00ff88" : "rgba(0,255,136,0.25)",
          fontSize: 12,
          fontWeight: 700,
          cursor: canSend ? "pointer" : "not-allowed",
          fontFamily: "monospace",
          letterSpacing: "0.05em",
          flexShrink: 0,
          alignSelf: "flex-end",
          marginBottom: 2,
        }}
      >
        {sending ? "..." : "Send"}
      </button>
    </div>
  );
}
