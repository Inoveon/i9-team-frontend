"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AgentGrid } from "@/components/AgentPane";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { useTeamStore } from "@/lib/store";
import { api, sendViaBridge, BridgeUnavailableError, AgentNotFoundError } from "@/lib/api";
import { toast } from "sonner";
import type { Team } from "@/types";

type PageTab = "agents" | "notes";

export default function TeamPage() {
  const params = useParams<{ project: string; team: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeTeam, setActiveTeam } = useTeamStore();

  const initialTab: PageTab = searchParams.get("tab") === "notes" ? "notes" : "agents";
  const [pageTab, setPageTab] = useState<PageTab>(initialTab);

  const changeTab = useCallback(
    (next: PageTab) => {
      setPageTab(next);
      const current = new URLSearchParams(searchParams.toString());
      if (next === "notes") current.set("tab", "notes");
      else current.delete("tab");
      // Limpa ?note= se saindo de notas
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
    // Polling só faz sentido na aba de agentes (evita refresh em cima do editor)
    if (pageTab !== "agents") return;
    const interval = setInterval(() => void fetchTeam(), 5000);
    return () => clearInterval(interval);
  }, [fetchTeam, pageTab]);

  const orchestrator = activeTeam?.agents.find((a) => a.role === "orchestrator");

  /**
   * Envia mensagem ao agente.
   *
   * Onda 1 — Fix F7: aceita `agentIdOverride` opcional (worker alvo).
   * Onda 5 — aceita `opts.attachmentIds` (UUIDs pré-uploadados em
   *   POST /upload/image?teamId=<id>). O backend (Onda 5) valida e
   *   injeta as imagens no tmux.
   */
  const handleSendMessage = async (
    message: string,
    agentIdOverride?: string,
    opts?: { attachmentIds?: string[] }
  ) => {
    if (!activeTeam) {
      console.warn("[TeamPage] handleSendMessage abortado — activeTeam ausente", { message });
      throw new Error("Team ainda não carregado — aguarde.");
    }

    const targetAgent = agentIdOverride
      ? activeTeam.agents.find((a) => a.id === agentIdOverride)
      : orchestrator;

    if (!targetAgent) {
      console.warn("[TeamPage] handleSendMessage abortado — agente destino ausente", {
        teamId: activeTeam.id,
        agentIdOverride,
        message,
      });
      throw new Error(
        agentIdOverride
          ? "Agente destinatário não encontrado neste team."
          : "Nenhum orquestrador configurado neste team."
      );
    }

    console.log("[TeamPage] sendViaBridge", {
      teamId: activeTeam.id,
      agentName: targetAgent.name,
      agentRole: targetAgent.role,
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
              <span style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────────────────── */}
      {!activeTeam ? (
        <div
          className="card"
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
