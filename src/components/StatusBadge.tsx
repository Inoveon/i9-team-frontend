"use client";

import type { AgentStatus } from "@/types";

const STATUS_CONFIG: Record<
  AgentStatus | "running" | "stopped" | "error",
  { label: string; color: string; dot: string }
> = {
  idle: {
    label: "Idle",
    color: "var(--text-tertiary)",
    dot: "var(--text-tertiary)",
  },
  running: {
    label: "Running",
    color: "var(--status-success)",
    dot: "var(--status-success)",
  },
  error: {
    label: "Error",
    color: "var(--status-error)",
    dot: "var(--status-error)",
  },
  stopped: {
    label: "Stopped",
    color: "var(--text-tertiary)",
    dot: "var(--text-tertiary)",
  },
};

interface StatusBadgeProps {
  status: keyof typeof STATUS_CONFIG;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const dotSize = size === "sm" ? 6 : 8;
  const fontSize = size === "sm" ? "11px" : "12px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        color: config.color,
        fontSize,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          backgroundColor: config.dot,
          boxShadow:
            status === "running"
              ? `0 0 8px ${config.dot}`
              : undefined,
          animation: status === "running" ? "pulse 2s infinite" : undefined,
        }}
      />
      {config.label}
    </span>
  );
}
