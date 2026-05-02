'use client';

import React from 'react';
import { StatusDot } from './glass';

type AgentStatus = 'online' | 'working' | 'offline' | 'error';

interface AgentCardProps {
  name: string;
  role: string;
  status: AgentStatus;
  sessionId?: string;
  className?: string;
}

export function AgentCard({ name, role, status, sessionId, className = '' }: AgentCardProps) {
  const isActive = status === 'online' || status === 'working';

  return (
    <div
      className={`glass rounded-xl p-3 transition-opacity duration-200 ${className}`}
      style={{
        backgroundColor: 'var(--glass-surface-2)',
        opacity: isActive ? 1 : 0.45,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <StatusDot status={status} />
        <span
          className="text-sm font-medium leading-none truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {name}
        </span>
      </div>

      <div className="pl-3.5 flex flex-col gap-0.5">
        <span
          className="text-xs leading-none truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {role}
        </span>

        {sessionId && (
          <span
            className="text-[11px] leading-none truncate"
            style={{
              color: 'var(--text-tertiary)',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}
          >
            {sessionId}
          </span>
        )}
      </div>
    </div>
  );
}
