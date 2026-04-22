"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

export type ToastKind = "info" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  actions?: { label: string; onClick: () => void; variant?: "primary" | "ghost" }[];
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const KIND_COLORS: Record<ToastKind, { bg: string; border: string; fg: string }> = {
  info: {
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.4)",
    fg: "var(--neon-blue)",
  },
  success: {
    bg: "rgba(0,255,136,0.08)",
    border: "rgba(0,255,136,0.4)",
    fg: "var(--neon-green)",
  },
  error: {
    bg: "rgba(255,56,100,0.08)",
    border: "rgba(255,56,100,0.4)",
    fg: "var(--neon-red)",
  },
  warning: {
    bg: "rgba(255,215,0,0.08)",
    border: "rgba(255,215,0,0.4)",
    fg: "var(--neon-yellow)",
  },
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps): ReactNode {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 9999,
        maxWidth: 420,
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const c = KIND_COLORS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              style={{
                background: "rgba(13,17,23,0.95)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                color: "var(--text)",
                fontSize: 13,
                boxShadow: `0 0 20px ${c.bg}`,
                minWidth: 280,
              }}
            >
              {t.title && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: c.fg,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 4,
                  }}
                >
                  {t.title}
                </div>
              )}
              <div style={{ color: "var(--text)", lineHeight: 1.5 }}>
                {t.message}
              </div>
              {t.actions && t.actions.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    justifyContent: "flex-end",
                  }}
                >
                  {t.actions.map((a, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        a.onClick();
                        onDismiss(t.id);
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border:
                          a.variant === "primary"
                            ? `1px solid ${c.border}`
                            : "1px solid rgba(255,255,255,0.08)",
                        background:
                          a.variant === "primary" ? c.bg : "transparent",
                        color: a.variant === "primary" ? c.fg : "var(--text-muted)",
                        fontSize: 11,
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => onDismiss(t.id)}
                aria-label="Fechar"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 2,
                }}
              >
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
