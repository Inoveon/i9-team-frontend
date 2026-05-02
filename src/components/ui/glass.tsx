'use client';

import React from 'react';
import type { RcStatus } from '@/types';

// ---------------------------------------------------------------------------
// GlassPanel
// ---------------------------------------------------------------------------
interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  surface?: 1 | 2 | 3;
  children?: React.ReactNode;
}

export function GlassPanel({
  surface = 1,
  className = '',
  children,
  ...props
}: GlassPanelProps) {
  const surfaceVar =
    surface === 1
      ? 'var(--glass-surface-1)'
      : surface === 2
        ? 'var(--glass-surface-2)'
        : 'var(--glass-surface-3)';

  return (
    <div
      className={`glass rounded-xl ${className}`}
      style={{ backgroundColor: surfaceVar }}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlassCard
// ---------------------------------------------------------------------------
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function GlassCard({ className = '', children, ...props }: GlassCardProps) {
  return (
    <div
      className={`glass rounded-xl p-4 ${className}`}
      style={{ backgroundColor: 'var(--glass-surface-2)' }}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlassButton
// ---------------------------------------------------------------------------
interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost';
  children?: React.ReactNode;
}

export function GlassButton({
  variant = 'default',
  className = '',
  children,
  ...props
}: GlassButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none';

  const variants = {
    default: 'glass px-3 py-1.5 text-[var(--text-primary)] hover:brightness-125 active:scale-[0.98]',
    ghost:
      'px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-surface-2)] active:scale-[0.98]',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// GlassInput
// ---------------------------------------------------------------------------
type GlassInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function GlassInput({ className = '', ...props }: GlassInputProps) {
  return (
    <input
      className={`w-full rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none transition-all duration-150 focus:border-[var(--glass-highlight)] ${className}`}
      style={{
        backgroundColor: 'var(--glass-surface-2)',
        border: '1px solid var(--glass-border)',
      }}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// SectionLabel
// ---------------------------------------------------------------------------
interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <span className={`section-label ${className}`}>{children}</span>
  );
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------
type StatusType = 'online' | 'working' | 'offline' | 'error';

interface StatusDotProps {
  status: StatusType;
  className?: string;
}

export function StatusDot({ status, className = '' }: StatusDotProps) {
  const dotClass: Record<StatusType, string> = {
    online: 'dot-online',
    working: 'dot-working',
    offline: 'dot-offline',
    error: 'dot-error',
  };

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass[status]} ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// RcDot — Remote Control status badge
// ---------------------------------------------------------------------------
interface RcDotProps {
  status: RcStatus;
  className?: string;
}

export function RcDot({ status, className = '' }: RcDotProps) {
  if (status === 'unknown') return null;

  const styles: Record<Exclude<RcStatus, 'unknown'>, React.CSSProperties> = {
    active: {
      backgroundColor: '#ffffff',
      boxShadow: '0 0 4px 1px rgba(255,255,255,0.4)',
      opacity: 1,
    },
    reconnecting: {
      backgroundColor: '#FFD60A',
      boxShadow: '0 0 6px 2px rgba(255,214,10,0.5)',
      animation: 'pulse 1.2s ease-in-out infinite',
    },
    disconnected: {
      backgroundColor: '#888',
      opacity: 0.3,
    },
  };

  return (
    <span
      title={`RC: ${status}`}
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${className}`}
      style={styles[status as Exclude<RcStatus, 'unknown'>]}
    />
  );
}

// ---------------------------------------------------------------------------
// GlassSelect
// ---------------------------------------------------------------------------
type GlassSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function GlassSelect({ className = '', children, ...props }: GlassSelectProps) {
  return (
    <select
      className={`rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none transition-all duration-150 ${className}`}
      style={{
        backgroundColor: 'var(--glass-surface-2)',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
      }}
      {...props}
    >
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// LoadingShimmer
// ---------------------------------------------------------------------------
interface LoadingShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function LoadingShimmer({ className = '', ...props }: LoadingShimmerProps) {
  return <div className={`shimmer rounded-lg ${className}`} {...props} />;
}
