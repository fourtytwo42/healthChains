'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';

/**
 * Main Layout - Provides sidebar and header shell
 */
export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

