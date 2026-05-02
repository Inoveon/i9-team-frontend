'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { AgentPanel } from '@/components/AgentPanel';
import { AgentView } from '@/components/AgentView';
import type { Agent } from '@/types';

export interface AgentPaneProps {
  agent: Agent;
  teamId: string;
  onSendMessage: (msg: string, agentId: string, opts?: { attachmentIds?: string[] }) => Promise<void>;
  isOrchestrator?: boolean;
}

export function AgentPane({ agent, teamId, onSendMessage, isOrchestrator = false }: AgentPaneProps) {
  // Key para forçar remount do terminal (reconexão)
  const [terminalKey, setTerminalKey] = useState(0);

  const handleSend = useCallback(
    (msg: string, opts?: { attachmentIds?: string[] }) =>
      onSendMessage(msg, agent.id, opts),
    [onSendMessage, agent.id]
  );

  // Botões do header: estilo glass consistente
  const headerBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 5,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        borderRadius: 12,
        border: isOrchestrator
          ? '1px solid rgba(255,255,255,0.14)'
          : '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'var(--glass-surface-1)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: isOrchestrator
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(255,255,255,0.02)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isOrchestrator ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-mono), monospace',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.name}
        </span>
        {isOrchestrator && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              padding: '1px 5px',
              flexShrink: 0,
            }}
          >
            ORCH
          </span>
        )}
        <StatusBadge status={agent.status} size="sm" />
        {/* Botão refresh/reconexão */}
        <button
          onClick={() => setTerminalKey((k) => k + 1)}
          title="Reconectar terminal"
          style={headerBtnStyle}
        >
          <RefreshCw size={14} strokeWidth={1.2} />
        </button>
      </div>

      {/* Terminal/Panel */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {agent.sessionId ? (
          <AgentView
            key={terminalKey}
            session={agent.sessionId}
            showInput
            teamId={teamId}
            onSendMessage={handleSend}
          />
        ) : (
          <AgentPanel
            key={terminalKey}
            agent={agent}
            showInput
            teamId={teamId}
            onSendMessage={handleSend}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Splitter — arrastável vertical entre dois painéis
// ---------------------------------------------------------------------------

interface SplitterProps {
  direction: 'horizontal' | 'vertical';
  onDrag: (delta: number) => void;
}

export function Splitter({ direction, onDrag }: SplitterProps) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastPos.current = direction === 'vertical' ? e.clientX : e.clientY;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const pos = direction === 'vertical' ? ev.clientX : ev.clientY;
        const delta = pos - lastPos.current;
        lastPos.current = pos;
        onDrag(delta);
      };
      const onUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [direction, onDrag]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        flexShrink: 0,
        width: direction === 'vertical' ? 4 : '100%',
        height: direction === 'vertical' ? '100%' : 4,
        cursor: direction === 'vertical' ? 'col-resize' : 'row-resize',
        backgroundColor: 'transparent',
        transition: 'background-color 150ms',
        position: 'relative',
        zIndex: 10,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// AgentGrid — orquestrador à esquerda + workers à direita com splitter
// ---------------------------------------------------------------------------

type LayoutMode = 'GRID' | 'FOCO';
type Orientation = 'horizontal' | 'vertical';

const RATIO_PRESETS = [20, 30, 40, 50] as const;

interface AgentGridProps {
  agents: Agent[];
  orchestratorId?: string;
  teamId: string;
  teamName: string;
  onSendMessage: (msg: string, agentId?: string, opts?: { attachmentIds?: string[] }) => Promise<void>;
}

function gridCols(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 2;
  return 3;
}

export function AgentGrid({ agents, orchestratorId, teamId, teamName, onSendMessage }: AgentGridProps) {
  const orch = agents.find((a) => a.id === orchestratorId) ?? agents[0];
  const allWorkers = agents.filter((a) => a.id !== orch?.id);
  // IDs dos workers visíveis — por padrão todos visíveis
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set(allWorkers.map((a) => a.id)));
  const workers = allWorkers.filter((a) => visibleIds.has(a.id));

  const toggleWorker = useCallback((id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } // mínimo 1 visível
      else next.add(id);
      return next;
    });
  }, []);

  // orchPct = porcentagem do painel esquerdo (orquestrador)
  const [orchPct, setOrchPct] = useState(40);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const activeCount = agents.filter((a) => a.status !== 'stopped').length;

  const onSendForAgent = useCallback(
    (msg: string, agentId: string, opts?: { attachmentIds?: string[] }) =>
      onSendMessage(msg, agentId, opts),
    [onSendMessage]
  );

  // Drag splitter
  const onSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startPct = orchPct;
      const container = containerRef.current;
      if (!container) return;
      const totalW = container.offsetWidth;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX;
        const deltaPct = (delta / totalW) * 100;
        const next = Math.min(70, Math.max(15, startPct + deltaPct));
        setOrchPct(next);
      };
      const onUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [orchPct]
  );

  const cols = gridCols(workers.length);
  const rows = Math.ceil(workers.length / cols);
  const [colSizes, setColSizes] = useState<number[]>(() => Array(cols).fill(100 / cols));
  const [rowSizes, setRowSizes] = useState<number[]>(() => Array(rows).fill(100 / rows));

  useEffect(() => { setColSizes(Array(cols).fill(100 / cols)); }, [cols]);
  useEffect(() => { setRowSizes(Array(rows).fill(100 / rows)); }, [rows]);

  const rowWorkers: Agent[][] = [];
  for (let r = 0; r < rows; r++) rowWorkers.push(workers.slice(r * cols, (r + 1) * cols));

  const onColDrag = useCallback((colIdx: number, delta: number) => {
    setColSizes((prev) => {
      const next = [...prev];
      const total = 100;
      const deltaPct = (delta / (containerRef.current?.offsetWidth ?? 800)) * total;
      const a = next[colIdx] + deltaPct;
      const b = (next[colIdx + 1] ?? 0) - deltaPct;
      if (a < 10 || b < 10) return prev;
      next[colIdx] = a;
      next[colIdx + 1] = b;
      return next;
    });
  }, []);

  const onRowDrag = useCallback((rowIdx: number, delta: number) => {
    setRowSizes((prev) => {
      const next = [...prev];
      const deltaPct = (delta / (containerRef.current?.offsetHeight ?? 600)) * 100;
      const a = next[rowIdx] + deltaPct;
      const b = (next[rowIdx + 1] ?? 0) - deltaPct;
      if (a < 10 || b < 10) return prev;
      next[rowIdx] = a;
      next[rowIdx + 1] = b;
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {teamName}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono), monospace' }}>
          {activeCount}/{agents.length} ativos
        </span>
        {/* Ratio presets */}
        {RATIO_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setOrchPct(p)}
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 5,
              border: '1px solid rgba(255,255,255,0.1)',
              background: Math.round(orchPct) === p ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: Math.round(orchPct) === p ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono), monospace',
            }}
          >
            {p}/{100 - p}
          </button>
        ))}
        {/* Orientação */}
        <button
          onClick={() => setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))}
          style={{
            fontSize: 11,
            padding: '2px 9px',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          title="Orientação workers"
        >
          {orientation === 'horizontal' ? '⇔' : '⇕'}
        </button>
        {/* Seletor de workers visíveis */}
        {allWorkers.length > 0 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 8 }}>
            {allWorkers.map((w) => (
              <button
                key={w.id}
                onClick={() => toggleWorker(w.id)}
                title={w.name}
                style={{
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: visibleIds.has(w.id) ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: visibleIds.has(w.id) ? 'var(--text-primary)' : 'rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono), monospace',
                  maxWidth: 90,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.name.replace('team-', '').replace('-', '​-')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Layout principal */}
      <div ref={containerRef} style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', padding: 8, gap: 0 }}>

        {/* Painel orquestrador */}
        {orch && (
          <div style={{ width: `${orchPct}%`, minWidth: 0, minHeight: 0, flexShrink: 0 }}>
            <AgentPane agent={orch} teamId={teamId} onSendMessage={onSendForAgent} isOrchestrator />
          </div>
        )}

        {/* Splitter central */}
        {orch && workers.length > 0 && (
          <div
            onMouseDown={onSplitterMouseDown}
            style={{
              width: 6,
              flexShrink: 0,
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              transition: 'background-color 150ms',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
          />
        )}

        {/* Grid de workers */}
        {workers.length > 0 && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {rowWorkers.map((rowItems, rowIdx) => (
              <div
                key={rowIdx}
                style={{ display: 'flex', flexDirection: 'column', flex: `${rowSizes[rowIdx] ?? (100 / rows)} 1 0%`, minHeight: 0 }}
              >
                <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 0 }}>
                  {rowItems.map((agent, colIdx) => (
                    <div
                      key={agent.id}
                      style={{ flex: `${colSizes[colIdx] ?? (100 / cols)} 1 0%`, minWidth: 0, padding: 4, display: 'flex', flexDirection: 'column' }}
                    >
                      <AgentPane agent={agent} teamId={teamId} onSendMessage={onSendForAgent} isOrchestrator={false} />
                    </div>
                  ))}
                  {rowItems.length > 1 && rowItems.slice(0, -1).map((_, cIdx) => (
                    <Splitter key={`col-${cIdx}`} direction="vertical" onDrag={(d) => onColDrag(cIdx, d)} />
                  ))}
                </div>
                {rowIdx < rowWorkers.length - 1 && (
                  <Splitter direction="horizontal" onDrag={(d) => onRowDrag(rowIdx, d)} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
