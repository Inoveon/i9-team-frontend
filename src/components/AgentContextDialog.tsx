"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, RefreshCw, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import matter from "gray-matter";
import {
  ContextFrontmatter,
  type AgentFrontmatter,
} from "./ContextFrontmatter";
import { api } from "@/lib/api";

/**
 * AgentContextDialog — Modal Liquid Glass que exibe o `agent-context.md`
 * de um agente (renderizado como markdown).
 *
 * Backend endpoint: `GET /teams/:teamId/agents/:name/context` →
 *   `{ markdown: string, lastUpdate: string, exists: boolean }`
 *
 * Resiliente: se o endpoint ainda não existir (Task #29 paralela), o
 * `try/catch` mostra mensagem amigável.
 */

interface AgentContextResponse {
  markdown: string;
  lastUpdate: string;
  exists: boolean;
}

interface AgentContextDialogProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  agentName: string;
}

export function AgentContextDialog({
  open,
  onClose,
  teamId,
  agentName,
}: AgentContextDialogProps) {
  const [markdown, setMarkdown] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Garante que o Portal renderiza no <body> — não dentro do PanelGroup.
  // Sem isso, parents com transform/overflow podem deslocar o modal.
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  const load = useCallback(async () => {
    if (!teamId || !agentName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AgentContextResponse>(
        `/teams/${encodeURIComponent(teamId)}/agents/${encodeURIComponent(
          agentName
        )}/context`
      );
      setMarkdown(data.markdown ?? "");
      setLastUpdate(data.lastUpdate ?? "");
      if (!data.exists) {
        setError(
          "Sem contexto criado ainda — esse agente nunca atualizou seu agent-context."
        );
      }
    } catch (err) {
      setMarkdown("");
      setLastUpdate("");
      setError(
        err instanceof Error
          ? `Erro ao carregar contexto: ${err.message}`
          : "Erro ao carregar contexto."
      );
    } finally {
      setLoading(false);
    }
  }, [teamId, agentName]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Parse YAML frontmatter (Issue #14): separa metadados do body markdown.
  const { frontmatter, body } = useMemo<{
    frontmatter: AgentFrontmatter | null;
    body: string;
  }>(() => {
    if (!markdown) return { frontmatter: null, body: "" };
    try {
      const parsed = matter(markdown);
      const fm = parsed.data as AgentFrontmatter;
      // Considera "tem frontmatter" se gray-matter extraiu pelo menos 1 chave
      const hasFm = fm && Object.keys(fm).length > 0;
      return {
        frontmatter: hasFm ? fm : null,
        body: parsed.content ?? markdown,
      };
    } catch {
      return { frontmatter: null, body: markdown };
    }
  }, [markdown]);

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
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="dialog-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <Dialog.Content asChild forceMount>
                  <motion.div
                    className="dialog-content dialog-content--wide glass-modal"
                    initial={{ opacity: 0, scale: 0.96, y: 14 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{
                      type: "spring",
                      stiffness: 320,
                      damping: 28,
                      mass: 0.8,
                    }}
                    aria-describedby={undefined}
                    onClick={(e) => e.stopPropagation()}
                  >
                {/* Title acessível (Radix exige Dialog.Title — VisuallyHidden
                    pra não duplicar visualmente o header abaixo) */}
                <VisuallyHidden>
                  <Dialog.Title>{`${agentName} — Contexto`}</Dialog.Title>
                </VisuallyHidden>
                <div className="dialog-header">
                  <p className="dialog-title">
                    <FileText size={14} aria-hidden="true" />
                    <span
                      style={{
                        color: "var(--text-primary)",
                        textTransform: "none",
                        letterSpacing: 0,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {agentName}
                    </span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    Contexto
                  </p>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      onClick={() => void load()}
                      disabled={loading}
                      className="agent-frame__btn"
                      title="Recarregar contexto"
                      aria-label="Recarregar contexto"
                    >
                      <RefreshCw
                        size={14}
                        className={loading ? "spinning" : undefined}
                      />
                    </button>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="agent-frame__btn"
                        title="Fechar"
                        aria-label="Fechar"
                      >
                        <X size={14} />
                      </button>
                    </Dialog.Close>
                  </div>
                </div>
                <div className="dialog-body">
                  {loading && !markdown && (
                    <div className="dialog-empty">Carregando contexto…</div>
                  )}
                  {error && !loading && (
                    <div className="dialog-empty">{error}</div>
                  )}
                  {!error && markdown && (
                    <>
                      {frontmatter && <ContextFrontmatter fm={frontmatter} />}
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {body}
                        </ReactMarkdown>
                      </div>
                    </>
                  )}
                </div>
                {lastUpdate && !error && (
                  <div className="dialog-footer">
                    Última atualização:{" "}
                    {(() => {
                      try {
                        return new Date(lastUpdate).toLocaleString("pt-BR");
                      } catch {
                        return lastUpdate;
                      }
                    })()}
                  </div>
                )}
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
