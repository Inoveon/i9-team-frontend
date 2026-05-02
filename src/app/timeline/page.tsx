'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Shell } from '@/components/layout/shell';
import { GlassCard, GlassButton, LoadingShimmer } from '@/components/ui/glass';
import { getBridgeStatus } from '@/lib/api';
import type { BridgeMessage } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ---------------------------------------------------------------------------
// Message Row
// ---------------------------------------------------------------------------

function MessageRow({ msg, last }: { msg: BridgeMessage; last: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr 80px 88px 60px',
        gap: 12,
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid var(--glass-border)',
        fontSize: 13,
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        {formatTs(msg.ts_in)}
      </span>
      <span style={{ color: 'var(--text-primary)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{msg.from_agent}</span>
        <span style={{ color: 'var(--text-tertiary)', margin: '0 6px' }}>→</span>
        <span>{msg.to_agent}</span>
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
        {msg.type}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        {truncate(msg.corr_id, 8)}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
        {msg.execution_ms != null ? `${msg.execution_ms}ms` : '—'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TimelinePage() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<BridgeMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasHistory, setHasHistory] = useState(true);

  async function fetchData() {
    try {
      const status = await getBridgeStatus();
      if (status.recent_messages && status.recent_messages.length > 0) {
        // Reverse chronological order
        setMessages([...status.recent_messages].reverse());
        setHasHistory(true);
      } else {
        setHasHistory(false);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  const activePage = pathname === '/timeline' ? 'timeline' : 'dashboard';

  return (
    <Shell activePage={activePage} breadcrumb="Timeline">
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <GlassButton
            onClick={() => { setLoading(true); void fetchData(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={14} strokeWidth={1.2} />
            Atualizar
          </GlassButton>
        </div>

        {/* Error */}
        {error && (
          <GlassCard style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#FF453A' }}>
            <AlertCircle size={16} strokeWidth={1.2} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </GlassCard>
        )}

        {/* Content */}
        <GlassCard>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <LoadingShimmer className="h-10" />
              <LoadingShimmer className="h-10" />
              <LoadingShimmer className="h-10" />
              <LoadingShimmer className="h-10" />
            </div>
          ) : !hasHistory ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Timeline disponível após implementação do histórico no bridge
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Endpoint /bridge/status não retornou recent_messages
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nenhuma mensagem registrada</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 80px 88px 60px',
                  gap: 12,
                  padding: '0 0 8px',
                  borderBottom: '1px solid var(--glass-border)',
                  marginBottom: 4,
                }}
              >
                {['Hora', 'From → To', 'Tipo', 'Corr ID', 'Latência'].map((h) => (
                  <span key={h} style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                    {h}
                  </span>
                ))}
              </div>
              {messages.map((msg, i) => (
                <MessageRow key={msg.corr_id + i} msg={msg} last={i === messages.length - 1} />
              ))}
            </>
          )}
        </GlassCard>

      </div>
    </Shell>
  );
}
