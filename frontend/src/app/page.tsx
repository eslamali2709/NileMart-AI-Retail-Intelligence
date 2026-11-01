import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { PageHeading } from "@/components/page-heading";

const features: { title: string; description: string; href: string; icon: IconName; action: string }[] = [
  { title: "Sales Reports", description: "Browse your n8n report catalog, search and filter by branch or month, identify multiple uploads, and open PDFs in Google Drive.", href: "/sales-reports", icon: "reports", action: "View Reports" },
  { title: "Upload Report", description: "Upload PDFs with server-side validation and n8n automation for Google Drive storage, Google Sheets logging, and duplicate and error handling.", href: "/upload-report", icon: "upload", action: "Upload Report" },
  { title: "AI Assistant", description: "Ask AI-powered questions grounded in retrieved report content, with conversation memory and formatted Markdown responses through n8n.", href: "/ai-assistant", icon: "assistant", action: "Open AI Assistant" },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeading title="Dashboard" description="Browse sales reports, upload monthly PDFs, and ask AI-powered questions about your reports from one workspace." badge="Workspace ready" />
      <section aria-labelledby="overview-title" className="overflow-hidden rounded-2xl border border-emerald-900 bg-emerald-950 p-7 text-white sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold tracking-[0.16em] text-emerald-200 uppercase">Workspace overview</p><span className="rounded-full border border-emerald-700 px-3 py-1 text-xs text-emerald-100">Reports, uploads & AI</span></div>
        <h2 id="overview-title" className="mt-8 max-w-lg text-2xl font-medium tracking-tight sm:text-3xl">One workspace.<br />A clearer view of your business.</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-100">Explore uploaded sales and inventory reports, submit new PDFs, and ask questions grounded in your report content. All three features are implemented and tested with server-side n8n integrations.</p>
        <div className="mt-8 border-t border-emerald-800 pt-5 text-xs leading-6 text-emerald-200">Designed for Cairo, Alexandria, Mansoura, and Giza.</div>
      </section>
      <section aria-labelledby="workspace-title" className="mt-9">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 id="workspace-title" className="text-lg font-semibold tracking-tight">Explore your workspace</h2><span className="text-xs text-slate-500">Workspace ready · Local development</span></div>
        <div className="grid gap-4 xl:grid-cols-3">
          {features.map(({ title, description, href, icon, action }) => (
            <Link key={href} href={href} className="group flex flex-col rounded-xl border border-stone-200 bg-white p-6 transition-colors hover:border-emerald-600">
              <div className="mb-6 flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon name={icon} /></span><span className="text-xs text-slate-500">Available</span></div>
              <h3 className="text-base font-semibold">{title}</h3><p className="mt-2 mb-6 text-sm leading-6 text-slate-600">{description}</p>
              <span className="mt-auto flex items-center gap-2 text-sm font-semibold text-emerald-800">{action} <Icon name="arrow" className="size-4" /></span>
            </Link>
          ))}
        </div>
      </section>
      <div className="mt-7 flex items-start gap-3 rounded-xl border border-stone-200 px-5 py-4"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-stone-400" aria-hidden="true" /><p className="text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-800">Feature availability, not live service health.</span> Available means the feature is implemented and tested. This Dashboard does not run live health checks. Requests depend on n8n and the services used by each feature being available.</p></div>
    </>
  );
}
