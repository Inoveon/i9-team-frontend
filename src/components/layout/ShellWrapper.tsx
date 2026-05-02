'use client';

import { usePathname } from 'next/navigation';
import { Shell } from './shell';

function pageIdFromPath(pathname: string): string {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/stats')) return 'stats';
  if (pathname.startsWith('/timeline')) return 'timeline';
  if (pathname.startsWith('/context')) return 'context';
  if (pathname.startsWith('/audit')) return 'audit';
  if (pathname.startsWith('/logs')) return 'logs';
  return 'dashboard';
}

export function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activePage = pageIdFromPath(pathname);

  // Na página de team, o Shell não tem padding lateral — o conteúdo gerencia seu próprio layout
  const isTeamPage = pathname.startsWith('/team/');

  return (
    <Shell
      activePage={activePage}
      breadcrumb={isTeamPage ? pathname.replace('/team/', '') : undefined}
    >
      {isTeamPage ? (
        // Team page controla seu próprio overflow/padding
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          {children}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </div>
      )}
    </Shell>
  );
}
