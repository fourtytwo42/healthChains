'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';
import { Footer } from './footer';

/**
 * Main Layout - Provides sidebar, header, and footer shell
 */
export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-background p-6 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

