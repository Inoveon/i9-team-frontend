"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { StatusBadge } from "./StatusBadge";
import { RcDot } from "./ui/glass";
import type { Team, RcStatus } from "@/types";

interface TeamCardProps {
  team: Team;
  onStart: (teamId: string) => void;
  onStop: (teamId: string) => void;
  /** Map keyed by "{project}/{team}/{agentName}" → RcStatus */
  rcStatusMap?: Record<string, RcStatus>;
}

export function TeamCard({ team, onStart, onStop, rcStatusMap = {} }: TeamCardProps) {
  const router = useRouter();
  const isRunning = team.status === "running";
  const runningAgents = team.agents.filter((a) => a.status === "running").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, boxShadow: "0 0 24px rgba(0,212,255,0.15)" }}
      transition={{ duration: 0.2 }}
      className="card"
      onClick={() => router.push(`/team/${team.project}/${team.name}`)}
      style={{ padding: "20px 24px", minWidth: 0, cursor: "pointer", position: "relative" }}
    >
      {/* Card inteiro clicável */}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {team.project}
          </p>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--accent)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "-0.01em",
            }}
          >
            {team.name}
          </span>
        </div>
        <div style={{ flexShrink: 0 }}>
          <StatusBadge status={team.status} />
        </div>
      </div>

      {/* Description */}
      {team.description && (
        <p
          style={{
            position: "relative",
            zIndex: 1,
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 14,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {team.description}
        </p>
      )}

      {/* Agent tags */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        {team.agents.map((agent) => {
          const rcKey = `${team.project}/${team.name}/${agent.name}`;
          const rcStatus = rcStatusMap[rcKey];
          return (
            <span
              key={agent.id}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                color: agent.status === "running" ? "var(--neon-green)" : "var(--text-muted)",
                backgroundColor: "var(--surface-2)",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {agent.name}
              {agent.role === "orchestrator" && rcStatus && rcStatus !== "unknown" && (
                <RcDot status={rcStatus} />
              )}
            </span>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {runningAgents}/{team.agents.length} ativos
        </span>

        <div style={{ display: "flex", gap: 8 }}>
          {isRunning ? (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(team.id); }}
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(239, 68, 68, 0.45)",
                background: "rgba(239, 68, 68, 0.08)",
                color: "var(--status-error)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.16)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onStart(team.id); }}
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(34, 197, 94, 0.45)",
                background: "rgba(34, 197, 94, 0.08)",
                color: "var(--status-success)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(34, 197, 94, 0.16)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(34, 197, 94, 0.08)";
              }}
            >
              Start
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
