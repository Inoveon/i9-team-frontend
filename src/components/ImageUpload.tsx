"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4020";

export interface UploadResult {
  url: string;
  filename?: string;
}

interface ImageUploadProps {
  onUpload?: (result: UploadResult) => void;
  collapsed?: boolean;
}

export function ImageUpload({ onUpload, collapsed: initialCollapsed = true }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são aceitas.");
      return;
    }
    setError(null);
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
      setPreview(`${API_BASE}${data.url}`);
      onUpload?.(data);
    } catch (err) {
      setError(`Erro no upload: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setUploading(false);
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
        <span style={{ color: "var(--neon-blue)", fontSize: 14 }}>🖼</span>
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
            <span style={{ display: "block", fontSize: 22, marginBottom: 6 }}>📂</span>
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
            <p style={{ fontSize: 11, color: "var(--neon-blue)", marginTop: 8 }}>
              ⏳ Enviando...
            </p>
          )}
          {error && (
            <p style={{ fontSize: 11, color: "#ff4444", marginTop: 8 }}>{error}</p>
          )}

          {/* Preview */}
          {preview && (
            <div style={{ marginTop: 10, position: "relative", display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                style={{
                  maxHeight: 160,
                  maxWidth: "100%",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  display: "block",
                }}
              />
              <button
                onClick={() => setPreview(null)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "rgba(0,0,0,0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#aaa",
                  fontSize: 11,
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#aaa"; }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
