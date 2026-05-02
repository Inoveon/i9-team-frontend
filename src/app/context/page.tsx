'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Shell } from '@/components/layout/shell';
import {
  GlassCard,
  LoadingShimmer,
  SectionLabel,
  StatusDot,
} from '@/components/ui/glass';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentContextEntry {
  agent: string;
  team: string;
  project: string;
  status: 'online' | 'working' | 'offline' | 'error' | string;
  current_focus: string;
  last_task_corr_id: string | null;
  updatedAt: string;
}

type StatusType = 'online' | 'working' | 'offline' | 'error';

function toStatusType(raw: string): StatusType {
  if (raw === 'online' || raw === 'working' || raw === 'error') return raw;
  if (raw === 'idle') return 'online';
  return 'offline';
}

// ---------------------------------------------------------------------------
// AgentContextCard
// ---------------------------------------------------------------------------

function AgentContextCard({ entry }: { entry: AgentContextEntry }) {
  const status = toStatusType(entry.status);
  const isOffline = status === 'offline';
  const shortCorr = entry.last_task_corr_id
    ? entry.last_task_corr_id.slice(0, 8)
    : '—';

  return (
    <GlassCard
      style={{ opacity: isOffline ? 0.45 : 1, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {/* Header: name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusDot status={status} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontFamily: 'Inter, sans-serif',
            flex: 1,
          }}
        >
          {entry.agent}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: 'var(--text-tertiary)',
          }}
        >
          {entry.status}
        </span>
      </div>

      {/* team / project */}
      <span
        style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          opacity: 0.45,
        }}
      >
        {entry.project}/{entry.team}
      </span>

      {/* current_focus */}
      {entry.current_focus && entry.current_focus !== 'idle' && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}
        >
          {entry.current_focus}
        </span>
      )}

      {/* last_task_corr_id */}
      <span
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: 'var(--text-tertiary)',
        }}
      >
        corr: {shortCorr}
      </span>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContextPage() {
  const pathname = usePathname();
  const [agents, setAgents] = useState<AgentContextEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchAgents() {
    try {
      const data = await api.get<{ agents: AgentContextEntry[]; total: number }>('/context/agents');
      setAgents(data.agents);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAgents();
    const interval = setInterval(() => void fetchAgents(), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Group by project
  const byProject = agents.reduce<Record<string, AgentContextEntry[]>>((acc, a) => {
    const key = a.project || 'unknown';
    (acc[key] ??= []).push(a);
    return acc;
  }, {});

  const activePage = pathname === '/context' ? 'context' : 'dashboard';

  return (
    <Shell activePage={activePage} breadcrumb="Context">
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Error */}
        {error && (
          <GlassCard style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#FF453A' }}>
            <AlertCircle size={16} strokeWidth={1.2} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </GlassCard>
        )}

        {/* Loading */}
        {loading && !error && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingShimmer key={i} className="h-28" />
            ))}
          </div>
        )}

        {/* Agents grouped by project */}
        {!loading && !error && agents.length === 0 && (
          <GlassCard style={{ textAlign: 'center', padding: '40px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              Nenhum agent-context encontrado em ~/.memory/teams/
            </span>
          </GlassCard>
        )}

        {!loading &&
          Object.entries(byProject).map(([project, projectAgents]) => (
            <div key={project} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SectionLabel>{project}</SectionLabel>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {projectAgents.map((a) => (
                  <AgentContextCard key={`${a.project}/${a.team}/${a.agent}`} entry={a} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </Shell>
  );
}
