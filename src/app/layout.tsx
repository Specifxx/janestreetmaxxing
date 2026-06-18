import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bill Street — A Quantitative Trading Firm",
  description:
    "Bill Street is a research-driven quantitative trading platform for US & ASX markets: a 5-factor opportunity model, transparent valuation price targets, a short-horizon ODTE desk, and published backtests. Coded end-to-end by Claude.",
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight">
      <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--bs-gold-2)] to-[var(--bs-gold)] text-[#0a0e17] font-bold bs-glow">
        B
      </span>
      <span>
        Bill <span className="bs-gradient-text">Street</span>
      </span>
    </Link>
  );
}

function Nav() {
  const link = "px-3 py-2 rounded-lg hover:bg-[var(--color-panel-2)] transition";
  return (
    <header className="border-b border-[var(--color-border)] sticky top-0 z-30 backdrop-blur bg-[rgba(10,14,23,0.72)]">
      <nav className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-6">
        <Logo />
        <div className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/terminal" className={link}>Terminal</Link>
          <Link href="/odte" className={link}>ODTE Desk</Link>
          <Link href="/orb" className={link}>ASX ORB</Link>
          <Link href="/autopilot" className={link}>Autopilot</Link>
          <Link href="/compare" className={link}>Compare</Link>
          <Link href="/portfolio" className={link}>Book</Link>
          <Link href="/research" className={link}>Research</Link>
          <Link href="/about" className={link}>Firm</Link>
        </div>
        <Link
          href="/terminal"
          className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-white hover:brightness-110 transition"
        >
          Open Terminal →
        </Link>
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
          <div className="max-w-7xl mx-auto px-5 py-8 grid gap-6 md:grid-cols-4 text-sm">
            <div className="md:col-span-2">
              <div className="font-semibold text-lg mb-2">
                Bill <span className="bs-gradient-text">Street</span>
              </div>
              <p className="text-[var(--color-muted)] max-w-md text-xs leading-relaxed">
                A research-driven quantitative trading platform for US &amp; ASX markets.
                Built end-to-end by Claude. We publish our methodology and our backtests —
                including the ones that didn&apos;t work.
              </p>
            </div>
            <div className="text-xs text-[var(--color-muted)] space-y-2">
              <div className="font-medium text-[var(--color-text)]">Platform</div>
              <Link href="/terminal" className="block hover:text-[var(--color-text)]">Terminal</Link>
              <Link href="/odte" className="block hover:text-[var(--color-text)]">ODTE Desk</Link>
              <Link href="/orb" className="block hover:text-[var(--color-text)]">ASX ORB Signaller</Link>
              <Link href="/portfolio" className="block hover:text-[var(--color-text)]">Portfolio &amp; Book</Link>
              <Link href="/research" className="block hover:text-[var(--color-text)]">Research &amp; Backtests</Link>
              <Link href="/about" className="block hover:text-[var(--color-text)]">The Firm</Link>
            </div>
            <div className="text-xs text-[var(--color-muted)] space-y-2">
              <div className="font-medium text-[var(--color-text)]">Coverage</div>
              <div>US equities (NYSE/Nasdaq)</div>
              <div>Australia (ASX)</div>
              <div>Optimised for Stake accounts</div>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]">
            <p className="max-w-7xl mx-auto px-5 py-4 text-[11px] text-[var(--color-muted)] leading-relaxed">
              <strong className="text-[var(--color-text)]">Important:</strong> Bill Street is a
              quantitative research tool that produces model-based estimates for educational purposes.
              It is not a licensed financial adviser, not personal financial advice, and not a
              guarantee of returns. Trading involves real risk of loss. Past and backtested
              performance does not predict future results. Do your own research and never risk money
              you cannot afford to lose. © {new Date().getFullYear()} Bill Street.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
