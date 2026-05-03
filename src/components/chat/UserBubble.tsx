"use client";

import type { EventAttachment } from "@/lib/chat-attachments";

interface UserBubbleProps {
  text: string;
  /**
   * Anexos exibidos abaixo do texto.
   *
   * Onda 5: bubbles otimistas renderizam thumbs usando `previewUrl`
   * (object URL local gerado pelo ChatInput). A URL permanece válida
   * enquanto o ChatInput estiver montado — alinhado com o TTL da session.
   */
  attachments?: EventAttachment[];
}

const THUMB = 120;

export function UserBubble({ text, attachments }: UserBubbleProps) {
  const hasAttachments = attachments && attachments.length > 0;
  const hasText = !!text && text.trim().length > 0;

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 14px",
          borderRadius: "16px 16px 4px 16px",
          background:
            "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(0,212,255,0.15) 100%)",
          border: "1px solid rgba(124,58,237,0.35)",
          color: "#e2e8f0",
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: "system-ui, sans-serif",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxShadow: "0 0 12px rgba(124,58,237,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: hasText && hasAttachments ? 10 : 0,
        }}
      >
        {hasText && <span>{text}</span>}

        {hasAttachments && (
          <div
            role="list"
            aria-label={`${attachments!.length} anexo(s)`}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {attachments!.map((a, idx) => (
              <a
                key={a.id ?? `att-${idx}`}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                role="listitem"
                aria-label={a.filename ?? `anexo ${idx + 1}`}
                title={a.filename}
                style={{
                  display: "block",
                  width: THUMB,
                  height: THUMB,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(124,58,237,0.3)",
                  background: "rgba(0,0,0,0.3)",
                  flexShrink: 0,
                  transition: "border-color 0.15s, transform 0.15s",
                }}
              >
                <img
                  src={a.url}
                  alt={a.filename ?? "anexo"}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
