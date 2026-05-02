'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle, BarChart2, Clock, Radio, Users } from 'lucide-react';
import { Shell } from '@/components/layout/shell';
import { GlassCard, LoadingShimmer } from '@/components/ui/glass';
import { getBridgeStatus, getBridgeStats } from '@/lib/api';
import type { BridgeStatus, BridgeStats } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function KpiCard({ label, value, icon }: KpiCardProps) {
  return (
    <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
        {icon}
        <span style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: 28,
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </span>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Bar Chart (vanilla canvas — no chart.js needed)
// ---------------------------------------------------------------------------

interface VolumeChartProps {
  data: { date: string; msgs: number }[];
}

function VolumeChart({ data }: VolumeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const max = Math.max(...data.map((d) => d.msgs), 1);
    const padLeft = 36;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 32;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const barGap = 4;
    const barW = Math.max(4, chartW / data.length - barGap);

    // Grid lines (3 horizontal)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (chartH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();
    }

    // Bars
    data.forEach((d, i) => {
      const x = padLeft + i * (barW + barGap);
      const barH = (d.msgs / max) * chartH;
      const y = padTop + chartH - barH;
      const opacity = 0.3 + 0.5 * (d.msgs / max);
      ctx.fillStyle = `rgba(240,240,240,${opacity})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 2);
      ctx.fill();
    });

    // X axis labels (show first, middle, last)
    ctx.fillStyle = 'rgba(240,240,240,0.25)';
    ctx.font = '10px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    const labelIndices = [0, Math.floor(data.length / 2), data.length - 1];
    labelIndices.forEach((i) => {
      const d = data[i];
      if (!d) return;
      const x = padLeft + i * (barW + barGap) + barW / 2;
      const label = d.date?.slice(5) ?? d.date ?? ""; // MM-DD
      ctx.fillText(label, x, H - 8);
    });
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StatsPage() {
  const pathname = usePathname();
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [stats, setStats] = useState<BridgeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const [s, st] = await Promise.all([getBridgeStatus(), getBridgeStats()]);
      setStatus(s);
      setStats(st);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 30_000);
    return () => clearInterval(interval);
  }, []);

  const activePage = pathname === '/stats' ? 'stats' : 'dashboard';

  return (
    <Shell activePage={activePage} breadcrumb="Stats">
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Error */}
        {error && (
          <GlassCard style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#FF453A' }}>
            <AlertCircle size={16} strokeWidth={1.2} />
            <span style={{ fontSize: 13 }}>{error}</span>
          </GlassCard>
        )}

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {loading ? (
            <>
              <LoadingShimmer className="h-24" />
              <LoadingShimmer className="h-24" />
              <LoadingShimmer className="h-24" />
              <LoadingShimmer className="h-24" />
            </>
          ) : (
            <>
              <KpiCard
                label="Uptime"
                value={status ? formatUptime(status.uptime_seconds) : '—'}
                icon={<Clock size={16} strokeWidth={1.2} />}
              />
              <KpiCard
                label="Mensagens"
                value={status ? String(status.msgs_received) : '—'}
                icon={<Radio size={16} strokeWidth={1.2} />}
              />
              <KpiCard
                label="Agentes esta semana"
                value={stats ? String(stats.top_agents_week.length) : '—'}
                icon={<Users size={16} strokeWidth={1.2} />}
              />
              <KpiCard
                label="Teams esta semana"
                value={stats ? String(stats.top_teams_week.length) : '—'}
                icon={<BarChart2 size={16} strokeWidth={1.2} />}
              />
            </>
          )}
        </div>

        {/* Top Agents + Top Teams */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Top Agents */}
          <GlassCard>
            <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Top Agentes — Semana
            </p>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <LoadingShimmer className="h-8" />
                <LoadingShimmer className="h-8" />
                <LoadingShimmer className="h-8" />
              </div>
            ) : stats && stats.top_agents_week.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stats.top_agents_week.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < stats.top_agents_week.length - 1 ? '1px solid var(--glass-border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.agent}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{a.msgs} msgs</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{a.avg_ms.toFixed(0)}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados</p>
            )}
          </GlassCard>

          {/* Top Teams */}
          <GlassCard>
            <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Top Teams — Semana
            </p>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <LoadingShimmer className="h-8" />
                <LoadingShimmer className="h-8" />
                <LoadingShimmer className="h-8" />
              </div>
            ) : stats && stats.top_teams_week.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {stats.top_teams_week.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < stats.top_teams_week.length - 1 ? '1px solid var(--glass-border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{t.project}/{t.team}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{t.msgs} msgs</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{t.avg_ms.toFixed(0)}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Sem dados</p>
            )}
          </GlassCard>
        </div>

        {/* Volume Chart */}
        <GlassCard>
          <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Volume Diário
          </p>
          {loading ? (
            <LoadingShimmer className="h-40" />
          ) : stats && stats.daily_volume.length > 0 ? (
            <div style={{ height: 160 }}>
              <VolumeChart data={stats.daily_volume} />
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>Sem dados de volume</p>
          )}
        </GlassCard>

      </div>
    </Shell>
  );
}
