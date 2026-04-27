"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, NotebookText } from "lucide-react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelGroupHandle,
} from "react-resizable-panels";
import { AgentView } from "@/components/AgentView";
import { AgentCard } from "@/components/AgentCard";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { useTeamStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  useAgentsLayout,
  type AgentsLayoutMode,
} from "@/hooks/useAgentsLayout";
import type { Team } from "@/types";

type PageTab = "agents" | "notes";

// localStorage keys
const LS_LAYOUT_MODE = "portal-agents-layout-mode";
const LS_SELECTED_IDS = "portal-agents-selected";

function loadLayoutMode(): AgentsLayoutMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(LS_LAYOUT_MODE);
  return v === "horiz" || v === "vert" || v === "auto" ? v : "auto";
}

function loadSelectedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const arr = JSON.parse(
      window.localStorage.getItem(LS_SELECTED_IDS) ?? "[]"
    );
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export default function TeamPage() {
  const params = useParams<{ project: string; team: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeTeam, setActiveTeam } = useTeamStore();

  const initialTab: PageTab =
    searchParams.get("tab") === "notes" ? "notes" : "agents";
  const [pageTab, setPageTab] = useState<PageTab>(initialTab);

  // Splitter
  const groupRef = useRef<ImperativePanelGroupHandle>(null);
  const [layout, setLayout] = useState<number[]>([50, 50]);

  // Layout do grid de workers (Auto / Horiz / Vert) — persistido
  const [layoutMode, setLayoutMode] = useState<AgentsLayoutMode>(loadLayoutMode);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_LAYOUT_MODE, layoutMode);
  }, [layoutMode]);

  // Multi-select de workers — persistido
  const [selectedIds, setSelectedIds] = useState<Set<string>>(loadSelectedIds);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_SELECTED_IDS,
      JSON.stringify(Array.from(selectedIds))
    );
  }, [selectedIds]);

  const toggleAgent = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const changeTab = useCallback(
    (next: PageTab) => {
      setPageTab(next);
      const current = new URLSearchParams(searchParams.toString());
      if (next === "notes") current.set("tab", "notes");
      else current.delete("tab");
      if (next !== "notes") current.delete("note");
      const qs = current.toString();
      const url = qs ? `?${qs}` : window.location.pathname;
      router.replace(url, { scroll: false });
    },
    [router, searchParams]
  );

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.get<{ team: Team }>(
        `/teams/${params.project}/${params.team}`
      );
      setActiveTeam(data.team);
    } catch {
      // ignore
    }
  }, [params.project, params.team, setActiveTeam]);

  useEffect(() => {
    void fetchTeam();
    if (pageTab !== "agents") return;
    const interval = setInterval(() => void fetchTeam(), 5000);
    return () => clearInterval(interval);
  }, [fetchTeam, pageTab]);

  const orchestrator = activeTeam?.agents.find(
    (a) => a.role === "orchestrator"
  );
  const workers = useMemo(
    () => activeTeam?.agents.filter((a) => a.role === "worker") ?? [],
    [activeTeam]
  );

  // Limpa seleção de IDs que não existem mais no team atual
  useEffect(() => {
    if (workers.length === 0) return;
    const validIds = new Set(workers.map((w) => w.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!validIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [workers]);

  const selectedWorkers = useMemo(
    () => workers.filter((w) => selectedIds.has(w.id)),
    [workers, selectedIds]
  );

  // Container ref pra medir aspect (modo auto)
  const terminalsContainerRef = useRef<HTMLDivElement>(null);
  const gridLayout = useAgentsLayout(
    selectedWorkers.length,
    layoutMode,
    terminalsContainerRef
  );

  /** Envia mensagem ao agente. */
  const handleSendMessage = async (
    message: string,
    agentIdOverride?: string,
    opts?: { attachmentIds?: string[] }
  ) => {
    if (!activeTeam) {
      throw new Error("Team ainda não carregado — aguarde.");
    }
    const targetAgent = agentIdOverride
      ? activeTeam.agents.find((a) => a.id === agentIdOverride)
      : orchestrator;
    if (!targetAgent) {
      throw new Error(
        agentIdOverride
          ? "Agente destinatário não encontrado neste team."
          : "Nenhum orquestrador configurado neste team."
      );
    }
    const attachmentIds = opts?.attachmentIds;
    const payload: {
      agentId: string;
      message: string;
      attachmentIds?: string[];
    } = { agentId: targetAgent.id, message };
    if (attachmentIds && attachmentIds.length > 0) {
      payload.attachmentIds = attachmentIds;
    }
    console.log("[TeamPage] POST /teams/:id/message", {
      teamId: activeTeam.id,
      agentName: targetAgent.name,
      bytes: message.length,
      attachments: attachmentIds?.length ?? 0,
    });
    try {
      await api.post(`/teams/${activeTeam.id}/message`, payload);
    } catch (err) {
      console.error("[TeamPage] POST /message FAIL", err);
      throw err;
    }
  };

  // Snap programático
  const snapTo = useCallback((sizes: [number, number]) => {
    groupRef.current?.setLayout(sizes);
    setLayout(sizes);
  }, []);

  useEffect(() => {
    if (pageTab !== "agents") return;
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "1") {
        e.preventDefault();
        snapTo([25, 75]);
      } else if (e.key === "2") {
        e.preventDefault();
        snapTo([50, 50]);
      } else if (e.key === "3") {
        e.preventDefault();
        snapTo([75, 25]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageTab, snapTo]);

  const snapLabel = (() => {
    const a = Math.round(layout[0] ?? 50);
    if (a >= 70) return "75/25";
    if (a <= 30) return "25/75";
    if (a >= 45 && a <= 55) return "50/50";
    return `${a}/${100 - a}`;
  })();

  return (
    <div
      style={{
        height: "100vh",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: "var(--text-tertiary)",
            textDecoration: "none",
          }}
        >
          Dashboard
        </Link>
        <span style={{ color: "rgba(255,255,255,0.08)", margin: "0 8px" }}>
          /
        </span>
        <span style={{ fontSize: 13, color: "var(--accent)" }}>
          {params.project} / {params.team}
        </span>
      </div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 16,
          letterSpacing: "-0.02em",
          flexShrink: 0,
        }}
      >
        {activeTeam?.name ?? `${params.project}/${params.team}`}
      </motion.h1>

      {/* Tabs página */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 20,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {(
          [
            { key: "agents", label: "Agentes", Icon: Bot },
            { key: "notes", label: "Notas", Icon: NotebookText },
          ] as {
            key: PageTab;
            label: string;
            Icon: typeof Bot;
          }[]
        ).map((t) => {
          const isActive = pageTab === t.key;
          const Icon = t.Icon;
          return (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
              style={{
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: isActive ? "var(--accent-soft)" : "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                color: isActive ? "var(--accent)" : "rgba(255,255,255,0.35)",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: -1,
              }}
            >
              <Icon size={14} aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────────────── */}
      {!activeTeam ? (
        <div
          className="glass"
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-tertiary)",
            flexShrink: 0,
          }}
        >
          Carregando team...
        </div>
      ) : pageTab === "notes" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <NotesPanel teamId={activeTeam.id} />
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            display: "flex",
          }}
        >
          <PanelGroup
            ref={groupRef}
            direction="horizontal"
            autoSaveId="portal-split-position"
            onLayout={(sizes) => setLayout(sizes)}
            style={{ flex: 1, minHeight: 0 }}
          >
            {/* ── Painel Orquestrador (100% altura) ────────────── */}
            <Panel defaultSize={50} minSize={20} maxSize={80}>
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 12,
                    flexShrink: 0,
                  }}
                >
                  Orquestrador
                </p>
                {orchestrator?.sessionId ? (
                  <AgentView
                    session={orchestrator.sessionId}
                    showInput
                    teamId={activeTeam.id}
                    onSendMessage={(m, opts) =>
                      handleSendMessage(m, undefined, opts)
                    }
                    agentName={orchestrator.name}
                    agentRole="orchestrator"
                    agentStatus={orchestrator.status}
                  />
                ) : (
                  <div
                    className="glass"
                    style={{
                      padding: 24,
                      color: "var(--text-tertiary)",
                      flexShrink: 0,
                    }}
                  >
                    {orchestrator
                      ? `Orquestrador "${orchestrator.name}" sem sessão ativa.`
                      : "Nenhum orquestrador configurado"}
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="resize-handle" />

            {/* ── Painel Workers (selector + toggle + grid) ─────── */}
            <Panel defaultSize={50} minSize={20} maxSize={80}>
              <div className="agents-pane">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                    padding: "0 4px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      margin: 0,
                    }}
                  >
                    Agentes ({selectedIds.size}/{workers.length})
                  </p>
                  {workers.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(
                          selectedIds.size === workers.length
                            ? new Set()
                            : new Set(workers.map((w) => w.id))
                        )
                      }
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-tertiary)",
                        cursor: "pointer",
                        fontFamily: '"JetBrains Mono", monospace',
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--text-secondary)";
                        e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.16)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-tertiary)";
                        e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.06)";
                      }}
                    >
                      {selectedIds.size === workers.length
                        ? "Limpar"
                        : "Todos"}
                    </button>
                  )}
                </div>

                {workers.length === 0 ? (
                  <div
                    className="glass"
                    style={{
                      padding: 24,
                      color: "var(--text-tertiary)",
                      flexShrink: 0,
                      margin: 4,
                    }}
                  >
                    Nenhum agente worker
                  </div>
                ) : (
                  <>
                    {/* Selector de cards */}
                    <div className="agents-selector">
                      {workers.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          selected={selectedIds.has(agent.id)}
                          onToggle={() => toggleAgent(agent.id)}
                        />
                      ))}
                    </div>

                    {/* Layout toggle */}
                    <div className="layout-toggle">
                      <span className="layout-toggle__label">Layout</span>
                      {(
                        [
                          { mode: "auto" as const, icon: "🤖", label: "Auto" },
                          {
                            mode: "horiz" as const,
                            icon: "⊞",
                            label: "Horiz",
                          },
                          { mode: "vert" as const, icon: "⊟", label: "Vert" },
                        ]
                      ).map((opt) => (
                        <button
                          key={opt.mode}
                          type="button"
                          aria-pressed={layoutMode === opt.mode}
                          onClick={() => setLayoutMode(opt.mode)}
                          title={`Layout ${opt.label}`}
                        >
                          <span aria-hidden="true">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                      {selectedWorkers.length > 0 && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 10,
                            color: "var(--text-tertiary)",
                            fontFamily: '"JetBrains Mono", monospace',
                            letterSpacing: "0.06em",
                          }}
                        >
                          {gridLayout.cols}×{gridLayout.rows}
                        </span>
                      )}
                    </div>

                    {/* Terminal grid (só selecionados) */}
                    <div
                      ref={terminalsContainerRef}
                      className="agents-terminals"
                      style={
                        selectedWorkers.length > 0
                          ? gridLayout.style
                          : undefined
                      }
                    >
                      {selectedWorkers.length === 0 ? (
                        <div className="agents-empty glass">
                          Clique em um ou mais agentes acima para abrir os
                          terminais
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {selectedWorkers.map((agent) => (
                            <motion.div
                              key={agent.id}
                              layout
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{
                                duration: 0.22,
                                ease: [0.25, 0.1, 0.25, 1],
                              }}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                                minWidth: 0,
                              }}
                            >
                              {agent.sessionId ? (
                                <AgentView
                                  session={agent.sessionId}
                                  showInput
                                  teamId={activeTeam.id}
                                  onSendMessage={(msg, opts) =>
                                    handleSendMessage(msg, agent.id, opts)
                                  }
                                  agentName={agent.name}
                                  agentRole="worker"
                                  agentStatus={agent.status}
                                />
                              ) : (
                                <div
                                  className="glass"
                                  style={{
                                    padding: 16,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                    minHeight: 0,
                                    flex: 1,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "var(--accent)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {agent.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "var(--text-tertiary)",
                                    }}
                                  >
                                    Sem sessão ativa
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Panel>
          </PanelGroup>

          {/* Snap indicator */}
          <div
            className="snap-indicator"
            title="Atalhos: Ctrl/Cmd + 1 (25/75) · 2 (50/50) · 3 (75/25)"
          >
            <span>{snapLabel}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <kbd>⌘1</kbd>
            <kbd>⌘2</kbd>
            <kbd>⌘3</kbd>
          </div>
        </div>
      )}
    </div>
  );
}
