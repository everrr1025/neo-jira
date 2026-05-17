import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Providers } from '@/components/Providers';
import { getCurrentLocale } from "@/lib/serverLocale";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Neo-Jira | Workspace',
  description: 'Agile project management for modern teams',
};

import { McpProvider } from '@/components/McpProvider';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const locale = await getCurrentLocale();

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <Providers>
          <McpProvider>
            <AppShell
              hasSession={!!session}
              authenticatedContent={
                <div className="flex min-h-screen bg-background">
                  <Sidebar locale={locale} />
                  <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
                    <Header initialLocale={locale} />
                    <div className="flex-1 overflow-auto bg-muted/35 p-6">{children}</div>
                  </main>
                </div>
              }
              unauthenticatedContent={<main className="min-h-screen">{children}</main>}
            />
          </McpProvider>
        </Providers>
      </body>
    </html>
  );
}
