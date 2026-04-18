"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal } from "@/components/TerminalWS";
import { ImageUpload } from "@/components/ImageUpload";
import { getAgents } from "@/lib/api";
import type { AgentStatus_Real } from "@/types";

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: active ? "var(--neon-green)" : "var(--text-muted)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: active ? "var(--neon-green)" : "var(--text-muted)",
          boxShadow: active ? "0 0 8px var(--neon-green)" : undefined,
          animation: active ? "pulse 2s infinite" : undefined,
          flexShrink: 0,
        }}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export default function TeamPage() {
  const { id } = useParams<{ id: string }>();
  const [teamName, setTeamName] = useState<string>("");
  const [agents, setAgents] = useState<AgentStatus_Real[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus_Real | null>(null);

  // Ref para só definir seleção inicial uma vez
  const initializedRef = useRef(false);
  // Ref atualizado IMEDIATAMENTE no clique — evita race com polling
  const selectedAgentRef = useRef<AgentStatus_Real | null>(null);
  selectedAgentRef.current = selectedAgent;

  function selectAgent(agent: AgentStatus_Real) {
    selectedAgentRef.current = agent; // atualiza ref antes do re-render
    setSelectedAgent(agent);
  }

  const fetchData = useCallback(async () => {
    try {
      const data = await getAgents(id);
      setTeamName(data.teamName);
      setAgents(data.agents);

      // Definir seleção inicial apenas uma vez
      if (!initializedRef.current && data.agents.length > 0) {
        initializedRef.current = true;
        const orch = data.agents.find((a) => a.role === "orchestrator");
        const firstActive = data.agents.find((a) => a.active);
        setSelectedAgent(orch ?? firstActive ?? data.agents[0] ?? null);
      }

      // Atualizar dados do agente selecionado sem trocar a seleção
      if (selectedAgentRef.current) {
        const updated = data.agents.find((a) => a.id === selectedAgentRef.current!.id);
        if (updated) setSelectedAgent(updated);
      }
    } catch {
      // backend offline
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const activeSession = selectedAgent?.sessionName ?? id;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--surface)",
        }}
      >
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          Dashboard
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--neon-blue)", fontWeight: 600 }}>
          {teamName || id}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
          {agents.filter((a) => a.active).length}/{agents.length} ativos
        </span>
      </div>

      {/* Split layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr", minHeight: 0 }}>
        {/* Left — agent list + image upload */}
        <div
          style={{
            borderRight: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <p
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 12,
            }}
          >
            Agentes ({agents.length})
          </p>

          {agents.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando...</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {agents.map((agent, i) => {
              const isSelected = selectedAgent?.id === agent.id;
              return (
                <motion.button
                  key={agent.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => selectAgent(agent)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${isSelected ? (agent.active ? "var(--neon-green)" : "var(--neon-blue)") : "var(--border)"}`,
                    background: isSelected ? "rgba(0, 212, 255, 0.06)" : "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "border-color 0.15s, background 0.15s",
                    boxShadow: isSelected ? "0 0 12px rgba(0,212,255,0.12)" : "none",
                    opacity: agent.active ? 1 : 0.55,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: agent.role === "orchestrator" ? "var(--neon-purple)" : "var(--neon-blue)",
                      marginBottom: 6,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {agent.name}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {agent.role}
                    </span>
                    <ActiveBadge active={agent.active} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>{/* end agent list scroll */}

          {/* Image upload — colapsável, na base da sidebar */}
          <ImageUpload session={activeSession} />
        </div>

        {/* Right — terminal */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", minHeight: 0 }}>
          {selectedAgent && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: selectedAgent.role === "orchestrator" ? "var(--neon-purple)" : "var(--neon-blue)",
                }}
              >
                {selectedAgent.name}
              </span>
              <ActiveBadge active={selectedAgent.active} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {selectedAgent.sessionName}
              </span>
            </div>
          )}

          <motion.div
            key={activeSession}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
          >
            <Terminal session={activeSession} showInput />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
