"use client";

import type { Attachment } from "@/lib/chat-attachments";

/**
 * AttachmentChip — Thumbnail 64×64 de um anexo pendente.
 *
 * Mostra:
 *   - a imagem (object URL local, não espera o upload).
 *   - overlay de status:
 *       * "uploading" → spinner + véu semi-transparente.
 *       * "error"     → véu vermelho + ícone de alerta; `title` mostra erro.
 *       * "uploaded"  → borda neon-green discreta.
 *   - botão X no canto superior direito para remover.
 *
 * Lazy-load via `loading="lazy"` no <img>.
 */

interface AttachmentChipProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
  /** Desabilita interação durante envio da mensagem (não pode remover chip mid-send) */
  disabled?: boolean;
}

const SIZE = 64;

export function AttachmentChip({ attachment, onRemove, disabled }: AttachmentChipProps) {
  const { id, previewUrl, status, file, error } = attachment;

  const isUploading = status === "uploading";
  const isError = status === "error";
  const isUploaded = status === "uploaded";

  const borderColor = isError
    ? "rgba(255,56,100,0.6)"
    : isUploaded
    ? "rgba(34, 197, 94, 0.45)"
    : "rgba(90, 200, 250, 0.3)";

  const title = isError
    ? `Erro: ${error ?? "upload falhou"}`
    : isUploading
    ? `Enviando ${file.name}...`
    : file.name;

  return (
    <div
      role="listitem"
      aria-label={file.name}
      title={title}
      style={{
        position: "relative",
        width: SIZE,
        height: SIZE,
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${borderColor}`,
        background: "rgba(0,0,0,0.4)",
        flexShrink: 0,
        transition: "border-color 0.15s",
      }}
    >
      {/* Preview */}
      <img
        src={previewUrl}
        alt={file.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: isError ? 0.35 : isUploading ? 0.6 : 1,
        }}
      />

      {/* Overlay de status */}
      {isUploading && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.2)",
              borderTopColor: "var(--neon-blue, var(--accent))",
              animation: "spin 0.8s linear infinite",
            }}
          />
          {/* keyframes via <style jsx> local — não afeta globals.css */}
          <style jsx>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      )}

      {isError && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,56,100,0.25)",
            color: "var(--neon-red, #ff3864)",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          !
        </div>
      )}

      {/* Botão remover */}
      <button
        type="button"
        onClick={() => onRemove(id)}
        disabled={disabled}
        aria-label={`Remover ${file.name}`}
        style={{
          position: "absolute",
          top: 2,
          right: 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "1px solid rgba(255,56,100,0.4)",
          background: "rgba(13,17,23,0.92)",
          color: "var(--neon-red, #ff3864)",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          fontSize: 11,
          lineHeight: 1,
          fontWeight: 700,
          fontFamily: "monospace",
          opacity: disabled ? 0.4 : 1,
          transition: "background 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.background = "rgba(255,56,100,0.25)";
          e.currentTarget.style.borderColor = "var(--neon-red, #ff3864)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(13,17,23,0.92)";
          e.currentTarget.style.borderColor = "rgba(255,56,100,0.4)";
        }}
      >
        ×
      </button>
    </div>
  );
}
