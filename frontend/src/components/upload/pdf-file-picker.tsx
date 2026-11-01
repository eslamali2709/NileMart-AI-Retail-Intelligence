"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/icon";
import { formatFileSize } from "@/lib/report-upload";

type Props = {
  file: File | null;
  error: string | null;
  checking: boolean;
  disabled?: boolean;
  onSelect: (files: File[]) => void;
  onRemove: () => void;
};

export function PdfFilePicker({ file, error, checking, disabled = false, onSelect, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (!disabled) onSelect(Array.from(event.dataTransfer.files));
  }

  return (
    <div>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (disabled || !event.dataTransfer.types.includes("Files")) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
        onDrop={drop}
        className={`rounded-xl border-2 border-dashed px-5 py-10 text-center transition-colors ${error ? "border-red-400 bg-red-50/50" : dragging ? "border-emerald-700 bg-emerald-100" : "border-stone-300 bg-stone-50/60"}`}
      >
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-stone-200 bg-white text-emerald-800"><Icon name="upload" className="size-6" /></span>
        <p className="text-base font-semibold text-slate-900">{dragging ? "Drop your PDF here" : "Drag and drop your report"}</p>
        <p id="file-help" className="mt-2 text-sm leading-6 text-slate-600">One PDF file containing monthly sales and inventory.</p>
        <input ref={inputRef} id="report-file" name="file" type="file" disabled={disabled} accept=".pdf,application/pdf" className="hidden" tabIndex={-1}
          aria-label="Choose report PDF" onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length) onSelect(files);
          }} />
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} aria-describedby={`file-help${error ? " file-error" : ""}`}
          className="mt-5 rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50">
          {file ? "Replace File" : "Browse Files"}
        </button>
        <p className="mt-3 text-xs text-slate-500">PDF only · Sent only when you select Upload Report</p>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {checking && <p className="mt-3 text-sm text-slate-600">Checking PDF format…</p>}
        {file && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <Icon name="reports" className="size-6 shrink-0 text-emerald-800" />
            <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold text-slate-900">{file.name}</p><p className="mt-1 text-xs text-slate-600">{formatFileSize(file.size)} · PDF selected</p></div>
            <button type="button" disabled={disabled} onClick={onRemove} aria-label={`Remove ${file.name}`} className="shrink-0 rounded-md px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50">Remove</button>
          </div>
        )}
      </div>
      {error && <p id="file-error" role="alert" className="mt-3 text-sm leading-6 text-red-700">{error}</p>}
    </div>
  );
}
