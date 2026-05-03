"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AgentGrid } from "@/components/AgentPane";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { useTeamStore } from "@/lib/store";
import { api, sendViaBridge, BridgeUnavailableError, AgentNotFoundError } from "@/lib/api";
import { toast } from "sonner";
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

  const orchestrator = activeTeam?.agents.find((a) => a.role === "orchestrator");

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

    console.log("[TeamPage] sendViaBridge", {
      teamId: activeTeam.id,
      agentName: targetAgent.name,
      bytes: message.length,
    });
    try {
      const resp = await sendViaBridge(activeTeam.id, targetAgent.name, message);
      console.log("[TeamPage] bridge OK", resp);
    } catch (err) {
      if (err instanceof BridgeUnavailableError) {
        toast.error("Bridge indisponível — mensagem não entregue");
      } else if (err instanceof AgentNotFoundError) {
        toast.error("Agente não encontrado");
      } else {
        toast.error(err instanceof Error ? err.message : "Erro ao enviar mensagem");
      }
      console.error("[TeamPage] bridge FAIL", err);
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
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {/* Tabs da página (Agentes / Notas) */}
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          paddingLeft: 12,
        }}
      >
        {(
          [
            { key: "agents", label: "Agentes", icon: "▸" },
            { key: "notes", label: "Notas", icon: "◉" },
          ] as { key: PageTab; label: string; icon: string }[]
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
                background: "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid rgba(255,255,255,0.6)"
                  : "2px solid transparent",
                color: isActive ? "var(--text-primary)" : "rgba(255,255,255,0.35)",
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

      {/* ── CONTEÚDO ─────────────────────────────────────────────────── */}
      {!activeTeam ? (
        <div
          className="glass"
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
            margin: 24,
          }}
        >
          Carregando team...
        </div>
      ) : pageTab === "notes" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <NotesPanel teamId={activeTeam.id} />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <AgentGrid
            agents={activeTeam.agents}
            orchestratorId={orchestrator?.id}
            teamId={activeTeam.id}
            teamName={activeTeam.name ?? `${params.project}/${params.team}`}
            onSendMessage={(msg, agentId, opts) => handleSendMessage(msg, agentId, opts)}
          />
        </motion.div>
      )}
    </div>
  );
}
