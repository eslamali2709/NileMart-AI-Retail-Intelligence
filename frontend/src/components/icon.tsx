export type IconName = "dashboard" | "reports" | "upload" | "assistant" | "arrow";

const paths: Record<IconName, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  reports: "M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h8",
  upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  assistant: "M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z M8 10h8 M8 14h5",
  arrow: "M5 12h14 M14 7l5 5-5 5",
};

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
