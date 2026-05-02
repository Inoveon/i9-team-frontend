'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { GlassCard, GlassButton, GlassSelect, LoadingShimmer } from '@/components/ui/glass';
import { getApiBase } from '@/lib/runtime-config';
import { getAuthToken } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEvent {
  id: string;
  ts: string;
  type: string;
  project?: string;
  team?: string;
  from?: string;
  to?: string;
  corr_id?: string;
  summary?: string;
  payload?: unknown;
}

interface AuditResponse {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function shortId(id?: string): string {
  return id ? id.slice(0, 8) : '—';
}

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// EventRow
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 90px 130px 160px 90px 1fr',
          gap: 8,
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--glass-border)',
          cursor: 'pointer',
          backgroundColor: expanded ? 'var(--glass-surface-2)' : 'transparent',
          transition: 'background-color 150ms',
        }}
        onMouseEnter={(e) => {
          if (!expanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--glass-surface-1)';
        }}
        onMouseLeave={(e) => {
          if (!expanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        {/* Timestamp */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {formatTs(event.ts)}
        </span>

        {/* Type */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--glass-border)',
            color: event.type === 'error' ? '#FF453A' : 'var(--text-secondary)',
            backgroundColor: event.type === 'error' ? 'rgba(255,69,58,0.08)' : 'var(--glass-surface-2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.type}
        </span>

        {/* Project/Team */}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.project && event.team ? `${event.project}/${event.team}` : event.project ?? event.team ?? '—'}
        </span>

        {/* From → To */}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.from && event.to ? `${event.from} → ${event.to}` : event.from ?? event.to ?? '—'}
        </span>

        {/* corr_id */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {shortId(event.corr_id)}
        </span>

        {/* Summary */}
        <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.summary ?? '—'}
        </span>
      </div>

      {/* Expanded payload */}
      {expanded && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--glass-border)',
            backgroundColor: 'var(--glass-surface-1)',
          }}
        >
          <pre
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              margin: 0,
            }}
          >
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterProject, setFilterProject] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterType, setFilterType] = useState('');

  // Distinct values for filter dropdowns
  const [projects, setProjects] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);

  async function fetchData(pageNum = 0) {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const BASE_URL = getApiBase();
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE),
      });
      if (filterProject) params.set('project', filterProject);
      if (filterTeam) params.set('team', filterTeam);
      if (filterType) params.set('type', filterType);

      const res = await fetch(`${BASE_URL}/audit/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as AuditResponse;
      setEvents(data.events);
      setTotal(data.total);

      // Build filter options from ALL events (first load only)
      if (pageNum === 0 && !filterProject && !filterTeam && !filterType) {
        const allProjects = [...new Set(data.events.map((e) => e.project).filter(Boolean) as string[])].sort();
        const allTeams = [...new Set(data.events.map((e) => e.team).filter(Boolean) as string[])].sort();
        const allTypes = [...new Set(data.events.map((e) => e.type).filter(Boolean) as string[])].sort();
        setProjects(allProjects);
        setTeams(allTeams);
        setTypes(allTypes);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(0);
    void fetchData(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject, filterTeam, filterType]);

  async function handleExport() {
    try {
      const token = await getAuthToken();
      const BASE_URL = getApiBase();
      const params = new URLSearchParams({ format: 'csv' });
      if (filterProject) params.set('project', filterProject);
      if (filterTeam) params.set('team', filterTeam);
      if (filterType) params.set('type', filterType);
      const url = `${BASE_URL}/audit/export?${params.toString()}&token=${token}`;
      window.open(url, '_blank');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar');
    }
  }

  function handlePageChange(delta: number) {
    const next = page + delta;
    setPage(next);
    void fetchData(next);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Project filter */}
          <GlassSelect
            value={filterProject}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterProject(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">Todos os projetos</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </GlassSelect>

          {/* Team filter */}
          <GlassSelect
            value={filterTeam}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterTeam(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">Todos os teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </GlassSelect>

          {/* Type filter */}
          <GlassSelect
            value={filterType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">Todos os tipos</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </GlassSelect>

          <div style={{ flex: 1 }} />

          {/* Export */}
          <GlassButton onClick={() => void handleExport()}>
            <Download size={14} strokeWidth={1.2} />
            Export CSV
          </GlassButton>

          {/* Refresh */}
          <GlassButton onClick={() => { setPage(0); void fetchData(0); }}>
            <RefreshCw size={14} strokeWidth={1.2} />
            Atualizar
          </GlassButton>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,69,58,0.3)',
              backgroundColor: 'rgba(255,69,58,0.06)',
              color: '#FF453A',
              fontSize: 13,
            }}
          >
            <AlertCircle size={14} strokeWidth={1.2} />
            {error}
          </div>
        )}

        {/* Table */}
        <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 90px 130px 160px 90px 1fr',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid var(--glass-border)',
              backgroundColor: 'var(--glass-surface-3)',
            }}
          >
            {['Timestamp', 'Tipo', 'Project/Team', 'From → To', 'Corr ID', 'Summary'].map((h) => (
              <span
                key={h}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <LoadingShimmer key={i} style={{ height: 36, borderRadius: 6 }} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && events.length === 0 && (
            <div
              style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}
            >
              Nenhum evento encontrado
            </div>
          )}

          {/* Rows */}
          {!loading && events.map((ev) => <EventRow key={ev.id + ev.ts} event={ev} />)}
        </GlassCard>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span>{total} eventos no total</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GlassButton
                variant="ghost"
                onClick={() => handlePageChange(-1)}
                disabled={page === 0}
              >
                <ChevronLeft size={14} strokeWidth={1.2} />
                Anterior
              </GlassButton>
              <span style={{ fontSize: 12 }}>
                {page + 1} / {totalPages}
              </span>
              <GlassButton
                variant="ghost"
                onClick={() => handlePageChange(1)}
                disabled={page + 1 >= totalPages}
              >
                Próxima
                <ChevronRight size={14} strokeWidth={1.2} />
              </GlassButton>
            </div>
          </div>
        )}
      </div>
  );
}
