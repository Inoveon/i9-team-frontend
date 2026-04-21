"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import { AttachmentChip } from "./AttachmentChip";
import {
  extractFilesFromClipboard,
  makeLocalAttachmentId,
  uploadAttachment,
  validateAttachmentFile,
  type Attachment,
  type EventAttachment,
  ALLOWED_MIMES,
  MAX_ATTACHMENTS,
} from "@/lib/chat-attachments";

/**
 * ChatInput — Input multilinha com suporte a anexos (Ondas 4 + 5).
 *
 * Recursos:
 *   - textarea auto-grow 1..maxRows linhas (padrão 8).
 *   - Ctrl/Cmd+Enter envia; Enter sozinho quebra linha; IME guard.
 *   - Paste de imagem (Ctrl+V) → adiciona como anexo.
 *   - Botão 📎 abre file picker (múltiplo).
 *   - Upload imediato em paralelo (Promise separada por anexo).
 *   - Faixa de chips 64×64 acima do input quando há anexos.
 *   - Envio bloqueado enquanto algum upload está em progresso.
 *
 * API:
 *   - `onSend(message, extras)` — `extras.attachmentIds` são UUIDs do backend,
 *     `extras.attachments` traz previewUrl/filename para o otimismo da timeline.
 *   - `teamId` é necessário para uploads (POST /upload/image?teamId=<id>).
 *   - `onValidationError` permite pro pai exibir toast (validação de arquivo).
 */

export interface ChatInputSendExtras {
  attachmentIds?: string[];
  attachments?: EventAttachment[];
}

export interface ChatInputProps {
  onSend: (message: string, extras?: ChatInputSendExtras) => void | Promise<void>;

  /** Desabilita input + botão (além do estado interno `sending`) */
  disabled?: boolean;

  /** Placeholder do campo */
  placeholder?: string;

  /** Quantidade mínima de linhas (default: 1) */
  minRows?: number;

  /** Quantidade máxima de linhas antes de scroll interno (default: 8) */
  maxRows?: number;

  /**
   * Team ID — necessário para uploads de anexo. Se omitido, o botão 📎
   * e o paste handler ficam desabilitados (sem uploads possíveis).
   */
  teamId?: string;

  /** Callback pra exibir toasts de validação no pai */
  onValidationError?: (message: string) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Enviar mensagem ao agente...",
  minRows = 1,
  maxRows = 8,
  teamId,
  onValidationError,
}: ChatInputProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canAttach = !!teamId && !disabled && !sending;
  const hasUploading = attachments.some((a) => a.status === "uploading");
  const uploadedCount = attachments.filter((a) => a.status === "uploaded").length;
  const hasAttachments = attachments.length > 0;
  // Envio: precisa ter texto OU pelo menos 1 anexo uploaded. Não envia enquanto algum upload em andamento.
  const canSend =
    !sending &&
    !disabled &&
    !hasUploading &&
    (!!draft.trim() || uploadedCount > 0);

  // ── Cleanup de object URLs no unmount ────────────────────────────────
  // Revocamos o previewUrl ao remover cada chip; mas no unmount, anexos
  // que nunca foram enviados também precisam ser liberados — caso contrário
  // o navegador retém memória até fechar a aba.
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    return () => {
      for (const a of attachmentsRef.current) {
        URL.revokeObjectURL(a.previewUrl);
      }
    };
  }, []);

  // ── Adição de anexos (paste + file picker) ───────────────────────────

  const addFiles = useCallback(
    (files: File[]) => {
      if (!teamId || files.length === 0) return;

      // Precisa capturar `currentCount` via setAttachments callback porque
      // o handler pode ser chamado em sequência antes do re-render.
      const accepted: Attachment[] = [];
      setAttachments((prev) => {
        let count = prev.length;
        for (const file of files) {
          const err = validateAttachmentFile(file, count);
          if (err) {
            onValidationError?.(err);
            continue;
          }
          const id = makeLocalAttachmentId();
          const previewUrl = URL.createObjectURL(file);
          accepted.push({ id, file, previewUrl, status: "uploading" });
          count++;
        }
        return [...prev, ...accepted];
      });

      // Dispara uploads em paralelo (fora do setState — React fica feliz)
      for (const att of accepted) {
        void (async () => {
          try {
            const { id: uploadedId, url: uploadedUrl } = await uploadAttachment(
              teamId,
              att.file
            );
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === att.id
                  ? { ...a, status: "uploaded", uploadedId, uploadedUrl }
                  : a
              )
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === att.id ? { ...a, status: "error", error: msg } : a
              )
            );
            onValidationError?.(msg);
          }
        })();
      }
    },
    [teamId, onValidationError]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canAttach) return;
    const files = extractFilesFromClipboard(e.clipboardData);
    if (files.length > 0) {
      e.preventDefault(); // não cola path nem dados raw como texto
      addFiles(files);
    }
  };

  const onFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    // Reseta para permitir re-selecionar o mesmo arquivo
    e.target.value = "";
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSend = useCallback(async () => {
    if (!canSend) return;

    const msg = draft;
    const uploaded = attachments.filter((a) => a.status === "uploaded");
    const attachmentIds = uploaded
      .map((a) => a.uploadedId)
      .filter((x): x is string => !!x);
    const eventAttachments: EventAttachment[] = uploaded.map((a) => ({
      id: a.uploadedId,
      url: a.previewUrl, // preview local — bubble otimista usa isso
      filename: a.file.name,
    }));

    setSending(true);
    setDraft(""); // limpa imediatamente — UX fluida

    try {
      await onSend(
        msg,
        attachmentIds.length > 0
          ? { attachmentIds, attachments: eventAttachments }
          : undefined
      );
      // Após envio: limpa a lista, mas preserva URLs pois as bubbles as usam.
      // O revokeObjectURL dessas URLs acontece no unmount do ChatInput.
      setAttachments([]);
    } catch {
      // Feedback de erro fica com o pai via appendLocal("system", ...)
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [canSend, draft, attachments, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return; // IME guard
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.2)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "0 0 8px 8px",
        flexShrink: 0,
      }}
    >
      {/* Faixa de anexos — só renderiza se houver */}
      {hasAttachments && (
        <div
          role="list"
          aria-label="Anexos pendentes"
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 12px 0",
            overflowX: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,212,255,0.2) transparent",
          }}
        >
          {attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              attachment={a}
              onRemove={removeAttachment}
              disabled={sending}
            />
          ))}
          {attachments.length < MAX_ATTACHMENTS && (
            <span
              aria-hidden="true"
              style={{
                alignSelf: "center",
                fontSize: 10,
                color: "var(--text-muted)",
                fontFamily: "monospace",
                padding: "0 8px",
                whiteSpace: "nowrap",
              }}
            >
              {attachments.length}/{MAX_ATTACHMENTS}
            </span>
          )}
        </div>
      )}

      {/* Toolbar principal */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "8px 12px",
          alignItems: "flex-end",
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
          onPaste={handlePaste}
          disabled={sending || disabled}
          placeholder={sending ? "enviando..." : placeholder}
          aria-label="Mensagem para o agente"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          minRows={minRows}
          maxRows={maxRows}
          title="Enter: nova linha · Ctrl/Cmd+Enter: enviar · Ctrl+V: colar imagem"
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

        {/* Botão 📎 — acessibilidade e mobile (sem Ctrl+V) */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIMES.join(",")}
          multiple
          hidden
          onChange={onFilePick}
        />
        <button
          type="button"
          onClick={openFilePicker}
          disabled={!canAttach}
          aria-label="Anexar imagem"
          title="Anexar imagem (PNG, JPEG, WebP, GIF)"
          style={{
            width: 32,
            height: 32,
            padding: 0,
            borderRadius: 6,
            border: "1px solid rgba(0,212,255,0.3)",
            background: "transparent",
            color: canAttach ? "var(--neon-blue, #00d4ff)" : "rgba(0,212,255,0.25)",
            cursor: canAttach ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            alignSelf: "flex-end",
            marginBottom: 2,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!canAttach) return;
            e.currentTarget.style.background = "rgba(0,212,255,0.08)";
            e.currentTarget.style.borderColor = "rgba(0,212,255,0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.49" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label="Enviar mensagem"
          title={
            hasUploading
              ? "Aguardando uploads…"
              : "Enviar (Ctrl/Cmd+Enter)"
          }
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
    </div>
  );
}
