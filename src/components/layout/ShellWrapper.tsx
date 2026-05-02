'use client';

import { usePathname } from 'next/navigation';
import { Shell } from './shell';

const PAGE_META: Record<string, { id: string; label: string }> = {
  '/':         { id: 'dashboard', label: 'Dashboard' },
  '/stats':    { id: 'stats',     label: 'Stats' },
  '/timeline': { id: 'timeline',  label: 'Timeline' },
  '/context':  { id: 'context',   label: 'Context' },
  '/audit':    { id: 'audit',     label: 'Audit' },
  '/logs':     { id: 'logs',      label: 'Logs' },
};

function pageMeta(pathname: string): { id: string; label: string } {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  for (const [key, val] of Object.entries(PAGE_META)) {
    if (key !== '/' && pathname.startsWith(key)) return val;
  }
  return { id: 'dashboard', label: '' };
}

export function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTeamPage = pathname.startsWith('/team/');
  const { id: activePage, label } = pageMeta(pathname);
  const breadcrumb = isTeamPage ? pathname.replace('/team/', '') : label;

  return (
    <Shell activePage={activePage} breadcrumb={breadcrumb}>
      {isTeamPage ? (
        // Team page controla seu próprio overflow/padding — sem scroll principal
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          {children}
        </div>
      ) : (
        // Outras páginas: scroll vertical, padding generoso
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, minHeight: 0 }}>
          {children}
        </div>
      )}
    </Shell>
  );
}
