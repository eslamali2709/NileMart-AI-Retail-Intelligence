import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

const plugins = [remarkGfm, remarkBreaks];

function sourceUrl(url: string): string {
  // Keep the renderer's safety filter, then limit sources to web URLs and local anchors/paths.
  const safe = defaultUrlTransform(url);
  if (/[\\\s]/.test(safe)) return "";
  return /^(https?:\/\/|\/(?!\/)|#)/i.test(safe) ? safe : "";
}

const components: Components = {
  a: ({ href, children, title }) => href ? (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950 hover:decoration-emerald-700">
      {children}
    </a>
  ) : <span>{children}</span>,
  // Model-generated images must not trigger background requests; keep their descriptive text.
  img: ({ alt }) => alt ? <span>{alt}</span> : null,
  table: ({ children }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-lg border border-stone-200" role="region" aria-label="Report data table" tabIndex={0}>
      <table className="w-full min-w-96 border-collapse text-left text-sm leading-6">{children}</table>
    </div>
  ),
  pre: ({ children }) => (
    <pre className="my-4 max-w-full overflow-x-auto rounded-lg border border-stone-200 bg-white p-4 text-xs leading-6 whitespace-pre" tabIndex={0} aria-label="Code block">{children}</pre>
  ),
};

/** Untrusted assistant text becomes React elements, never HTML injection. */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 text-sm leading-7 text-slate-800 [overflow-wrap:anywhere]
      [&>:first-child]:mt-0 [&>:last-child]:mb-0
      [&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-slate-950 [&_em]:italic
      [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:leading-8
      [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-7
      [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold
      [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold
      [&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:font-semibold
      [&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:font-semibold
      [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6
      [&_li]:my-1 [&_li]:pl-1 [&_li::marker]:text-emerald-800 [&_li>p]:my-1
      [&_li>ul]:my-1 [&_li>ol]:my-1
      [&_code]:rounded [&_code]:bg-stone-200/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]
      [&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit
      [&_th]:border-b [&_th]:border-stone-200 [&_th]:bg-emerald-50 [&_th]:px-4 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-emerald-950
      [&_td]:border-b [&_td]:border-stone-200 [&_td]:px-4 [&_td]:py-2 [&_td]:align-top [&_tbody_tr:last-child_td]:border-b-0
      [&_tbody_tr:nth-child(even)]:bg-white/70
      [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-300 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600
      [&_hr]:my-5 [&_hr]:border-stone-200">
      <Markdown remarkPlugins={plugins} components={components} urlTransform={sourceUrl} skipHtml>{text}</Markdown>
    </div>
  );
}
