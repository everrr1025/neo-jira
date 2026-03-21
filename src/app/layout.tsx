import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Neo-Jira | Workspace',
  description: 'Agile project management for modern teams',
};

import { McpProvider } from '@/components/McpProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        <McpProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
              <Header />
              <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                {children}
              </div>
            </main>
          </div>
        </McpProvider>
      </body>
    </html>
  );
}
