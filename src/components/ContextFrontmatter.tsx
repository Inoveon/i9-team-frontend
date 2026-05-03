"use client";

import type { ReactNode } from "react";

/**
 * ContextFrontmatter — Renderiza o frontmatter YAML do agent-context.md
 * em uma seção visual estilizada acima do body markdown.
 *
 * Issue #14 — substitui o bloco de código YAML cru por:
 *   - Status pill colorido por estado
 *   - Grid responsivo de campos (project/team/agent/client/machine/branch)
 *   - last_update formatado em pt-BR
 *   - Tags como chips
 *   - Handoffs ativos em mini-cards
 *   - Blockers em destaque vermelho
 */

const STATUS_COLORS: Record<string, string> = {
  idle: "var(--text-tertiary)",
  working: "var(--status-success)",
  blocked: "var(--status-warning)",
  error: "var(--status-error)",
  handoff_pending: "var(--accent)",
};

interface Handoff {
  direction?: string;
  peer?: string;
  corr_id?: string;
  [k: string]: unknown;
}

export interface AgentFrontmatter {
  type?: string;
  schema_version?: number;
  project?: string;
  team?: string;
  agent?: string;
  client?: string;
  machine?: string;
  status?: string;
  last_update?: string;
  current_focus?: string;
  files_in_focus?: string[];
  active_handoffs?: Handoff[];
  blockers?: (string | { reason?: string; [k: string]: unknown })[];
  tags?: string[];
  related_notes?: string[];
  related_issues?: string[];
  last_task_corr_id?: string;
  git_branch?: string;
  [k: string]: unknown;
}

interface ContextFrontmatterProps {
  fm: AgentFrontmatter;
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function ContextField({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="ctx-field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <div className="ctx-field__label">{label}</div>
      <div className="ctx-field__value">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="ctx-field__value">—</span>;
  const color = STATUS_COLORS[status] ?? "var(--text-tertiary)";
  return (
    <span className="status-pill" style={{ color }}>
      {status}
    </span>
  );
}

export function ContextFrontmatter({ fm }: ContextFrontmatterProps) {
  const tags = Array.isArray(fm.tags) ? fm.tags : [];
  const handoffs = Array.isArray(fm.active_handoffs) ? fm.active_handoffs : [];
  const blockers = Array.isArray(fm.blockers) ? fm.blockers : [];

  return (
    <div className="ctx-frontmatter glass">
      <div className="ctx-fm__row">
        <ContextField label="Status">
          <StatusPill status={fm.status} />
        </ContextField>
        <ContextField label="Focus" wide>
          {fm.current_focus ?? "—"}
        </ContextField>
      </div>

      <div className="ctx-fm__row">
        <ContextField label="Project">{fm.project ?? "—"}</ContextField>
        <ContextField label="Team">{fm.team ?? "—"}</ContextField>
        <ContextField label="Agent">{fm.agent ?? "—"}</ContextField>
      </div>

      <div className="ctx-fm__row">
        <ContextField label="Client">{fm.client ?? "—"}</ContextField>
        <ContextField label="Machine">{fm.machine ?? "—"}</ContextField>
        <ContextField label="Branch">{fm.git_branch ?? "—"}</ContextField>
      </div>

      <div className="ctx-fm__row">
        <ContextField label="Last update">{formatDate(fm.last_update)}</ContextField>
        <ContextField label="Last task">
          {fm.last_task_corr_id ? <code>{fm.last_task_corr_id}</code> : "—"}
        </ContextField>
      </div>

      {tags.length > 0 && (
        <div className="ctx-fm__row">
          <ContextField label="Tags" wide>
            <div className="chip-row">
              {tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          </ContextField>
        </div>
      )}

      {handoffs.length > 0 && (
        <div className="ctx-fm__row">
          <ContextField label="Handoffs ativos" wide>
            <div className="ctx-cards">
              {handoffs.map((h, i) => (
                <div key={i} className="ctx-card ctx-card--handoff">
                  <span className="ctx-card__direction">
                    {h.direction ?? "→"}
                  </span>
                  <span className="ctx-card__peer">{h.peer ?? "—"}</span>
                  {h.corr_id && <code>{h.corr_id}</code>}
                </div>
              ))}
            </div>
          </ContextField>
        </div>
      )}

      {blockers.length > 0 && (
        <div className="ctx-fm__row">
          <ContextField label="Blockers" wide>
            <div className="ctx-cards">
              {blockers.map((b, i) => (
                <div key={i} className="ctx-card ctx-card--blocker">
                  {typeof b === "string" ? b : (b.reason ?? JSON.stringify(b))}
                </div>
              ))}
            </div>
          </ContextField>
        </div>
      )}
    </div>
  );
}
