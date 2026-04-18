"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4020";

const UPLOAD_SERVER_DIR = process.env.NEXT_PUBLIC_UPLOAD_DIR ?? "/tmp/i9-team-uploads";

export interface UploadResult {
  url: string;
  filename?: string;
  id?: string;
}

interface ImageUploadProps {
  /** Sessão tmux para enviar o caminho da imagem */
  session?: string;
  onUpload?: (result: UploadResult) => void;
  collapsed?: boolean;
}

export function ImageUpload({ session, onUpload, collapsed: initialCollapsed = true }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  // localPreview: URL.createObjectURL — imediato, sem depender do backend
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null); // caminho no servidor
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function clearPreview() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    setUploadedPath(null);
    setError(null);
    setSent(false);
  }

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são aceitas.");
      return;
    }
    setError(null);
    setSent(false);
    // Preview local imediato (não depende do backend)
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setUploadedPath(null);
    setUploading(true);
    try {
      let token = "";
      try { token = await getAuthToken(); } catch { /* sem token */ }

      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/upload/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as UploadResult;
      // data.url = "/uploads/uuid.ext" → path no servidor = UPLOAD_DIR/uuid.ext
      const filename = data.url.replace(/^\/uploads\//, "");
      setUploadedPath(`${UPLOAD_SERVER_DIR}/${filename}`);
      onUpload?.(data);
    } catch (err) {
      setError(`Erro no upload: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setUploading(false);
    }
  }

  async function sendToAgent() {
    if (!session || !uploadedPath) return;
    setSending(true);
    setError(null);
    try {
      let token = "";
      try { token = await getAuthToken(); } catch { /* sem token */ }
      const res = await fetch(`${API_BASE}/tmux/sessions/${encodeURIComponent(session)}/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ keys: uploadedPath }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent(true);
    } catch (err) {
      setError(`Erro ao enviar: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setSending(false);
    }
  }

  // Paste global (Ctrl+V)
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        if (collapsed) setCollapsed(false);
        uploadFile(file);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Header colapsável */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          textAlign: "left",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        Upload de Imagem
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{collapsed ? "▲" : "▼"}</span>
      </button>

      {!collapsed && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* Drag-drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) uploadFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "var(--neon-blue)" : "var(--border)"}`,
              borderRadius: 8,
              padding: "20px 12px",
              textAlign: "center",
              cursor: "pointer",
              background: dragging ? "rgba(0,212,255,0.05)" : "transparent",
              transition: "border-color 0.15s, background 0.15s",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto 8px" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Arraste uma imagem, <span style={{ color: "var(--neon-blue)" }}>clique aqui</span>
            <br />
            ou use <kbd style={{ fontSize: 10, color: "var(--neon-green)", fontFamily: "monospace" }}>Ctrl+V</kbd> para colar
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Status */}
          {uploading && (
            <p style={{ fontSize: 11, color: "var(--neon-blue)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Enviando...
            </p>
          )}
          {error && (
            <p style={{ fontSize: 11, color: "#ff4444", marginTop: 8 }}>{error}</p>
          )}

          {/* Preview local — aparece imediatamente ao selecionar/colar */}
          {localPreview && (
            <div style={{ marginTop: 10 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localPreview}
                  alt="Preview"
                  style={{
                    maxHeight: 140,
                    maxWidth: "100%",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    display: "block",
                    opacity: uploading ? 0.5 : 1,
                    transition: "opacity 0.2s",
                  }}
                />
                <button
                  onClick={clearPreview}
                  title="Remover imagem"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "rgba(0,0,0,0.75)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "50%",
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#ccc",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Botão enviar para o agente — aparece após upload concluído */}
              {uploadedPath && session && !uploading && (
                <div style={{ marginTop: 8 }}>
                  {sent ? (
                    <p style={{ fontSize: 11, color: "var(--neon-green)", display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Enviado ao agente
                    </p>
                  ) : (
                    <button
                      onClick={sendToAgent}
                      disabled={sending}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--neon-blue)",
                        background: "rgba(0,212,255,0.08)",
                        color: "var(--neon-blue)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: sending ? "wait" : "pointer",
                        opacity: sending ? 0.6 : 1,
                        fontFamily: "monospace",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!sending) e.currentTarget.style.background = "rgba(0,212,255,0.16)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,212,255,0.08)"; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      {sending ? "Enviando..." : "Enviar para o agente"}
                    </button>
                  )}
                </div>
              )}

              {/* Aviso se não há sessão selecionada */}
              {uploadedPath && !session && !uploading && (
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
                  Selecione um agente na lista para enviar a imagem.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
