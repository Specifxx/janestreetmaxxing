import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alpha Engine — Quant Stock & ODTE Screener",
  description:
    "Formula-driven stock analysis, valuation price targets, and a short-horizon (0-2 DTE) screener for US and ASX markets.",
};

function Nav() {
  return (
    <header className="border-b border-[var(--color-border)] sticky top-0 z-30 backdrop-blur bg-[rgba(10,14,23,0.7)]">
      <nav className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]" />
          Alpha Engine
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/" className="px-3 py-2 rounded-lg hover:bg-[var(--color-panel-2)]">
            Screener
          </Link>
          <Link href="/odte" className="px-3 py-2 rounded-lg hover:bg-[var(--color-panel-2)]">
            ODTE
          </Link>
          <Link href="/methodology" className="px-3 py-2 rounded-lg hover:bg-[var(--color-panel-2)]">
            Methodology
          </Link>
        </div>
        <div className="ml-auto text-xs text-[var(--color-muted)] hidden sm:block">
          US · ASX · not financial advice
        </div>
      </nav>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1 max-w-7xl w-full mx-auto px-5 py-8">{children}</main>
        <footer className="border-t border-[var(--color-border)] mt-10">
          <div className="max-w-7xl mx-auto px-5 py-6 text-xs text-[var(--color-muted)] space-y-1">
            <p>
              <strong className="text-[var(--color-text)]">Disclaimer:</strong> This tool produces
              quantitative, model-based estimates for educational purposes only. It is not financial
              advice, not a recommendation to buy or sell, and not a guarantee of future returns.
              Markets are uncertain; you can lose money. Do your own research.
            </p>
            <p>
              Data: Yahoo Finance (unofficial) + Reddit. Falls back to clearly-labelled sample data
              when live feeds are unavailable.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
