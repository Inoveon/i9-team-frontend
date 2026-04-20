"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface NewNoteDialogProps {
  open: boolean;
  existingNames: string[];
  onCancel: () => void;
  onCreate: (name: string, content: string) => Promise<void> | void;
}

const NAME_RE = /^[a-z0-9][a-z0-9-_]{0,99}$/i;

export function NewNoteDialog({
  open,
  existingNames,
  onCancel,
  onCreate,
}: NewNoteDialogProps) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setContent("");
      setError(null);
      setSubmitting(false);
      // Foca no próximo tick
      setTimeout(() => nameRef.current?.focus(), 60);
    }
  }, [open]);

  const validate = (): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Nome é obrigatório";
    if (!NAME_RE.test(trimmed))
      return "Nome inválido — apenas letras, números, hífen e underscore (1-100 chars, inicia em letra/número)";
    if (existingNames.includes(trimmed))
      return "Já existe uma nota com este nome";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim(), content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !submitting) {
      e.preventDefault();
      onCancel();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !submitting) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,11,20,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) onCancel();
          }}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(0,212,255,0.25)",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 0 40px rgba(0,212,255,0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--text)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Nova nota
              </h2>
              <button
                onClick={onCancel}
                disabled={submitting}
                aria-label="Fechar"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 20,
                  lineHeight: 1,
                  padding: 2,
                }}
              >
                ×
              </button>
            </div>
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: 0,
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Arquivo markdown no vault do team
            </p>

            <label
              style={{
                display: "block",
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Nome
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="minha-nota-2026-04-19"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.3)",
                color: "var(--text)",
                fontSize: 13,
                fontFamily: '"JetBrains Mono", monospace',
                outline: "none",
                marginBottom: 14,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Conteúdo inicial (opcional)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"# Título\n\nConteúdo da nota..."}
              disabled={submitting}
              rows={6}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.3)",
                color: "var(--text)",
                fontSize: 12,
                fontFamily: '"JetBrains Mono", monospace',
                outline: "none",
                resize: "vertical",
                marginBottom: 10,
              }}
            />

            {error && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(255,56,100,0.08)",
                  border: "1px solid rgba(255,56,100,0.3)",
                  color: "var(--neon-red)",
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 10,
              }}
            >
              <button
                onClick={onCancel}
                disabled={submitting}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting || !name.trim()}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid rgba(0,255,136,0.4)",
                  background: "rgba(0,255,136,0.08)",
                  color:
                    submitting || !name.trim()
                      ? "rgba(0,255,136,0.3)"
                      : "var(--neon-green)",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: '"JetBrains Mono", monospace',
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor:
                    submitting || !name.trim() ? "not-allowed" : "pointer",
                  boxShadow:
                    !submitting && name.trim()
                      ? "0 0 14px rgba(0,255,136,0.2)"
                      : "none",
                }}
              >
                {submitting ? "Criando..." : "Criar"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
