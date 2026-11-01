import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { PageHeading } from "@/components/page-heading";

type Props = {
  title: string;
  description: string;
  icon: IconName;
  emptyTitle: string;
  emptyDescription: string;
  planned: string[];
};

export function FeaturePlaceholder({ title, description, icon, emptyTitle, emptyDescription, planned }: Props) {
  return (
    <>
      <PageHeading title={title} description={description} />
      <section aria-labelledby="empty-title" className="rounded-2xl border border-stone-200 bg-white px-6 py-16 text-center sm:px-12">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon name={icon} className="size-7" /></div>
        <h2 id="empty-title" className="text-xl font-semibold tracking-tight text-slate-900">{emptyTitle}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">{emptyDescription}</p>
        <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-stone-50">Back to dashboard <Icon name="arrow" className="size-4" /></Link>
      </section>
      <section aria-labelledby="planned-title" className="mt-8 rounded-xl border border-stone-200 p-6">
        <h2 id="planned-title" className="text-sm font-semibold text-slate-900">Planned for a future phase</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
          {planned.map((item) => <li key={item} className="border-l-2 border-emerald-200 pl-3">{item}</li>)}
        </ul>
      </section>
    </>
  );
}
