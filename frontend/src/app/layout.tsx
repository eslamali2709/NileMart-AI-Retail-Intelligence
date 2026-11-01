import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dashboard | NileMart", template: "%s | NileMart" },
  description: "NileMart retail intelligence workspace for sales reports, PDF uploads, and AI-powered report questions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main-content" className="sr-only z-50 rounded-lg bg-white p-4 focus:not-sr-only focus:fixed focus:top-4 focus:left-4">Skip to content</a>
        <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
          <aside className="flex flex-col border-b border-stone-200 bg-white p-5 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0 lg:p-6">
            <Link href="/" aria-label="NileMart home" className="mb-7 flex w-fit items-center gap-3 lg:mb-12">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-900 text-xl font-bold text-white" aria-hidden="true">N</span>
              <span><span className="block text-xl font-bold tracking-tight">NileMart<span className="text-emerald-700">.</span></span><span className="block text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">Retail intelligence</span></span>
            </Link>
            <p className="mb-3 hidden px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase lg:block">Workspace</p>
            <Navigation />
            <div className="mt-auto hidden pt-12 lg:block">
              <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs font-semibold text-slate-800">A foundation for better decisions</p><p className="mt-2 text-xs leading-5 text-slate-500">Sales reports and AI insights, brought into one workspace.</p></div>
              <p className="mt-5 text-xs text-slate-500">NileMart · Local development</p>
            </div>
          </aside>
          <div className="min-w-0">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-5 lg:px-10">
              <p className="text-sm text-slate-500">NileMart <span className="mx-2 text-stone-300">/</span> Management workspace</p>
              <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-slate-600">Local development · Not for public use</span>
            </header>
            <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-6 py-8 sm:py-10 lg:px-10">{children}</main>
            <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-6 pb-6 text-xs leading-5 text-slate-500 lg:px-10"><span>AI-powered retail intelligence & automation</span><span>Workspace ready · Local development</span></footer>
          </div>
        </div>
      </body>
    </html>
  );
}
