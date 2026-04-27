"use client";

import { motion } from "framer-motion";
import type { Agent } from "@/types";

/**
 * AgentCard — Card compacto multi-select de worker.
 *
 * Issue #13:
 *   - Nome completo (ellipsis SÓ se realmente passar de min-width 200px)
 *   - Bullet colorido (verde/cinza/vermelho/amarelo) substitui badge "RUNNING"
 *   - Tooltip no hover com `${name} — ${status}`
 */

export interface AgentCardProps {
  agent: Agent;
  selected: boolean;
  onToggle: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  running: "Running",
  idle: "Idle",
  stopped: "Stopped",
  error: "Error",
};

export function AgentCard({ agent, selected, onToggle }: AgentCardProps) {
  const statusLabel = STATUS_LABELS[agent.status] ?? agent.status;
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={
        "agent-card glass" + (selected ? " agent-card--selected" : "")
      }
      title={`${agent.name} — ${statusLabel}`}
    >
      <span className="agent-card__name">{agent.name}</span>
      <span
        className={`agent-card__status-dot agent-card__status-dot--${agent.status}`}
        aria-label={statusLabel}
      />
      {selected && <span className="agent-card__indicator" aria-hidden="true" />}
    </motion.button>
  );
}
