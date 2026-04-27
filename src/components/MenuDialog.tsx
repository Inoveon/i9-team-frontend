"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { motion, AnimatePresence } from "framer-motion";

/**
 * MenuDialog — Modal Liquid Glass para seleção de opção interativa.
 *
 * Substitui o overlay inline do TerminalWS por um Radix Dialog com:
 *   - animação spring framer-motion (entrada/saída)
 *   - backdrop com blur (terminal fica desfocado atrás)
 *   - tema preview Liquid Glass (tokens locais; Task 17 globaliza)
 *   - navegação por teclado (1-9, setas, Enter, Esc)
 *
 * O componente é controlado: o pai dá `open`, `options`, `currentIndex` e
 * recebe `onSelect`/`onClose`. NÃO altera o protocolo do WebSocket — só
 * reformata o UX.
 */

export interface MenuOption {
  index: number;
  label: string;
}

export interface MenuDialogProps {
  open: boolean;
  options: MenuOption[];
  /** Índice destacado vindo do backend (1-based, default 1) */
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  /** Título exibido no header. Default: "Selecione uma opção" */
  title?: string;
}

// Tokens Liquid Glass agora vivem em `globals.css` (Task 17).
// Aplicados via className `glass-modal` no Dialog.Content + var(--accent).
const ACCENT = "var(--accent)";

export function MenuDialog({
  open,
  options,
  currentIndex,
  onSelect,
  onClose,
  title = "Selecione uma opção",
}: MenuDialogProps) {
  // Highlight local — começa no currentIndex do backend e responde a setas
  const [highlight, setHighlight] = useState<number>(currentIndex);

  // Garante que o Portal renderiza no <body> (evita deslocamento por
  // parents com transform/overflow — tipo PanelGroup/PanelResizeHandle).
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  // Sync highlight quando o currentIndex do backend muda OU quando reabre
  useEffect(() => {
    if (open) setHighlight(currentIndex);
  }, [currentIndex, open]);

  // ── Navegação por teclado ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      // Números 1-9 → seleção direta
      if (e.key >= "1" && e.key <= "9") {
        const num = Number(e.key);
        if (options.some((o) => o.index === num)) {
          e.preventDefault();
          onSelect(num);
          return;
        }
      }

      // Navegação por setas — atualiza highlight visual sem fechar
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (options.length === 0) return;
        setHighlight((cur) => {
          const idxs = options.map((o) => o.index);
          const pos = idxs.indexOf(cur);
          const dir = e.key === "ArrowDown" ? 1 : -1;
          const nextPos =
            pos === -1
              ? 0
              : (pos + dir + idxs.length) % idxs.length;
          return idxs[nextPos];
        });
        return;
      }

      // Enter → confirma highlight atual
      if (e.key === "Enter") {
        e.preventDefault();
        if (options.some((o) => o.index === highlight)) {
          onSelect(highlight);
        }
        return;
      }

      // Esc é tratado pelo Radix (onOpenChange), mas reforço aqui por segurança
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, options, highlight, onSelect, onClose]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount container={portalContainer ?? undefined}>
            {/* Overlay = flex container que centraliza o Content.
                Mais robusto contra parents com transform/overflow. */}
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={
                  {
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    zIndex: 9998,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  } as CSSProperties
                }
              >
                {/* Painel central — usa className glass-modal (globals.css) */}
                <Dialog.Content asChild forceMount>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 6 }}
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 26,
                      mass: 0.8,
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="menu-dialog-title"
                    className="glass-modal"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "relative",
                      width: "min(440px, 100%)",
                      maxWidth: "100%",
                      maxHeight: "min(78vh, 640px)",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      zIndex: 9999,
                      fontFamily:
                        '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                {/* Title acessível (Radix exige Dialog.Title — usa
                    VisuallyHidden pra manter screen reader feliz sem
                    duplicar visualmente o header abaixo) */}
                <VisuallyHidden>
                  <Dialog.Title>{title}</Dialog.Title>
                </VisuallyHidden>
                {/* Header visual */}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 18px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {/* Ícone (chevron) */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <p
                    id="menu-dialog-title"
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: ACCENT,
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      fontWeight: 700,
                    }}
                  >
                    {title}
                  </p>
                </div>

                {/* Lista de opções (scroll interno se passar do max-height) */}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "10px 10px",
                    overflowY: "auto",
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(90, 200, 250, 0.2) transparent",
                  }}
                >
                  {options.map((opt) => {
                    const isHighlight = opt.index === highlight;
                    return (
                      <motion.button
                        key={opt.index}
                        type="button"
                        onClick={() => onSelect(opt.index)}
                        onMouseEnter={() => setHighlight(opt.index)}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 28,
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: isHighlight
                            ? "1px solid rgba(90, 200, 250, 0.45)"
                            : "1px solid rgba(255,255,255,0.04)",
                          background: isHighlight
                            ? "rgba(90, 200, 250, 0.08)"
                            : "rgba(255,255,255,0.02)",
                          color: "#e6eaf2",
                          fontSize: 13,
                          fontFamily:
                            '"JetBrains Mono", "Fira Code", monospace',
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                          boxShadow: isHighlight
                            ? "0 0 0 4px rgba(90, 200, 250, 0.06), inset 0 1px 0 rgba(255,255,255,0.04)"
                            : "inset 0 1px 0 rgba(255,255,255,0.02)",
                          transition: "background 0.15s, border-color 0.15s",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: isHighlight
                              ? "rgba(90, 200, 250, 0.15)"
                              : "rgba(255,255,255,0.04)",
                            color: ACCENT,
                            fontWeight: 700,
                            fontSize: 14,
                            fontFamily: "monospace",
                            flexShrink: 0,
                            border: isHighlight
                              ? "1px solid rgba(90, 200, 250, 0.35)"
                              : "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          {opt.index}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {opt.label}
                        </span>
                        {isHighlight && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={ACCENT}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Footer com hint */}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 18px 12px",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    fontSize: 10,
                    color: "rgba(255,255,255,0.4)",
                    letterSpacing: "0.04em",
                    flexWrap: "wrap",
                  }}
                >
                  <Hint k="1-9">seleciona</Hint>
                  <Hint k="↑↓">navega</Hint>
                  <Hint k="Enter">confirma</Hint>
                  <Hint k="Esc">cancela</Hint>
                </div>
                  </motion.div>
                </Dialog.Content>
              </motion.div>
            </Dialog.Overlay>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

// ── Hint pill (footer) ─────────────────────────────────────────────────
function Hint({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        whiteSpace: "nowrap",
      }}
    >
      <kbd
        style={{
          fontFamily: "inherit",
          fontSize: 9,
          padding: "1px 6px",
          borderRadius: 4,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 0,
        }}
      >
        {k}
      </kbd>
      <span>{children}</span>
    </span>
  );
}
