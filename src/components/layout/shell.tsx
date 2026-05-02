'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Monitor,
  BarChart2,
  GitBranch,
  Brain,
  Scroll,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
}

interface ShellProps {
  children: React.ReactNode;
  activePage?: string;
  onNavigate?: (id: string) => void;
  titlebarRight?: React.ReactNode;
  breadcrumb?: string;
}

// ---------------------------------------------------------------------------
// Nav items definition
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Monitor size={16} strokeWidth={1.2} />, href: '/' },
  { id: 'stats', label: 'Stats', icon: <BarChart2 size={16} strokeWidth={1.2} />, href: '/stats' },
  { id: 'timeline', label: 'Timeline', icon: <GitBranch size={16} strokeWidth={1.2} />, href: '/timeline' },
  { id: 'context', label: 'Context', icon: <Brain size={16} strokeWidth={1.2} />, href: '/context' },
  { id: 'audit', label: 'Audit', icon: <Scroll size={16} strokeWidth={1.2} />, href: '/audit' },
  { id: 'logs', label: 'Logs', icon: <FileText size={16} strokeWidth={1.2} />, href: '/logs' },
];

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

interface NavItemProps {
  item: NavItemConfig;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavItem({ item, isActive, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className="w-full flex items-center gap-3 rounded-lg text-sm transition-all duration-150 focus-visible:outline-none group"
      style={{
        padding: collapsed ? '10px 14px' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        backgroundColor: isActive ? 'var(--glass-surface-3)' : 'transparent',
        borderLeft: isActive ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      <span className="flex-shrink-0" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {item.icon}
      </span>
      {!collapsed && (
        <span className="leading-none truncate font-normal">{item.label}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function Shell({ children, activePage = 'dashboard', onNavigate, titlebarRight, breadcrumb }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  function handleNavClick(item: NavItemConfig) {
    if (item.href) {
      router.push(item.href);
    }
    onNavigate?.(item.id);
  }

  const sidebarWidth = collapsed ? 52 : 200;

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Titlebar */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-4"
        style={{
          height: 44,
          backdropFilter: 'blur(32px) saturate(160%) brightness(1.1)',
          borderBottom: '1px solid var(--glass-border)',
          boxShadow: 'inset 0 -1px 0 var(--glass-border), 0 1px 0 var(--glass-highlight)',
          backgroundColor: 'var(--glass-surface-1)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <span
          className="font-medium text-sm leading-none select-none"
          style={{ color: 'var(--text-primary)', fontWeight: 500, letterSpacing: '-0.01em' }}
        >
          i9-team
        </span>

        {/* Separator */}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>/</span>

        {/* Breadcrumb */}
        {breadcrumb && (
          <span
            className="text-sm leading-none truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {breadcrumb}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right slot */}
        {titlebarRight}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{
            width: sidebarWidth,
            transition: 'width 180ms ease-out',
            borderRight: '1px solid var(--glass-border)',
            backgroundColor: 'var(--glass-surface-1)',
          }}
        >
          {/* Nav items */}
          <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                isActive={activePage === item.id}
                collapsed={collapsed}
                onClick={() => handleNavClick(item)}
              />
            ))}
          </nav>

          {/* Toggle button */}
          <div
            className="p-2"
            style={{ borderTop: '1px solid var(--glass-border)' }}
          >
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="w-full flex items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-none"
              style={{
                padding: '8px',
                color: 'var(--text-tertiary)',
              }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} strokeWidth={1.2} />
              ) : (
                <PanelLeftClose size={16} strokeWidth={1.2} />
              )}
            </button>
          </div>
        </aside>

        {/* Content area */}
        <main
          className="flex-1 overflow-hidden flex flex-col"
          style={{ minHeight: 0 }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
