import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
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
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        <Providers>
          <McpProvider>
            {session ? (
              <div className="flex min-h-screen">
                <Sidebar locale={locale} />
                <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
                  <Header initialLocale={locale} />
                  <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                    {children}
                  </div>
                </main>
              </div>
            ) : (
              <main className="min-h-screen">
                {children}
              </main>
            )}
          </McpProvider>
        </Providers>
      </body>
    </html>
  );
}
