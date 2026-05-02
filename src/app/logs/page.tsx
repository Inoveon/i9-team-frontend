'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FileText, Pause, Play, Trash2 } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass';
import { getApiBase } from '@/lib/runtime-config';
import { getAuthToken } from '@/lib/api';

const MAX_LINES = 500;

// ---------------------------------------------------------------------------
// SSE connection status dot
// ---------------------------------------------------------------------------

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: connected ? '#34C759' : '#FF453A',
          boxShadow: connected ? '0 0 6px #34C759' : '0 0 6px #FF453A',
          display: 'inline-block',
          animation: connected ? 'pulse 2s infinite' : 'none',
        }}
      />
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: connected ? '#34C759' : '#FF453A', letterSpacing: '0.06em' }}>
        {connected ? 'CONECTADO' : 'DESCONECTADO'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LogsPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  pausedRef.current = paused;

  const appendLine = useCallback((line: string) => {
    if (pausedRef.current) return;
    setLines((prev) => {
      const next = [...prev, line];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      try {
        const token = await getAuthToken();
        const BASE_URL = getApiBase();
        // Pass token as query param since EventSource doesn't support headers
        const url = `${BASE_URL}/bridge/logs?token=${encodeURIComponent(token)}`;
        es = new EventSource(url);
        esRef.current = es;

        es.onopen = () => {
          setConnected(true);
          appendLine('[SSE] Conectado ao stream de logs');
        };

        es.onmessage = (ev) => {
          appendLine(ev.data);
        };

        es.addEventListener('log', (ev) => {
          appendLine((ev as MessageEvent).data);
        });

        es.onerror = () => {
          setConnected(false);
          es?.close();
          appendLine('[SSE] Conexão perdida. Reconectando em 5s...');
          reconnectTimer = setTimeout(() => void connect(), 5000);
        };
      } catch (e) {
        setConnected(false);
        appendLine(`[SSE] Erro ao conectar: ${e instanceof Error ? e.message : String(e)}`);
        reconnectTimer = setTimeout(() => void connect(), 5000);
      }
    }

    void connect();

    return () => {
      es?.close();
      esRef.current = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [appendLine]);

  // Auto-scroll
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, paused]);


  return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
            <FileText size={16} strokeWidth={1.2} />
            <span style={{ fontSize: 13 }}>Bridge Logs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ConnectionDot connected={connected} />
            <GlassButton
              onClick={() => setLines([])}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Trash2 size={14} strokeWidth={1.2} />
              Limpar
            </GlassButton>
            <GlassButton
              onClick={() => setPaused((p) => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              {paused ? <Play size={14} strokeWidth={1.2} /> : <Pause size={14} strokeWidth={1.2} />}
              {paused ? 'Retomar' : 'Pausar'}
            </GlassButton>
          </div>
        </div>

        {/* Terminal */}
        <div
          style={{
            backgroundColor: '#000000',
            borderRadius: 12,
            border: '1px solid var(--glass-border)',
            height: 'calc(100vh - 160px)',
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {lines.length === 0 ? (
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'rgba(240,240,240,0.25)' }}>
              Aguardando eventos SSE...
            </span>
          ) : (
            lines.map((line, i) => (
              <span
                key={i}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'rgba(240,240,240,0.85)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {line}
              </span>
            ))
          )}
          <div ref={bottomRef} />
        </div>

      </div>
  );
}
