import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ParsedResultsTable } from "@/components/ParsedResultsTable";
import { MOCK_PARSED_ROWS, type ParsedRow } from "@/lib/mock-data";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan AVS — CareSync" },
      {
        name: "description",
        content: "Upload and verify After Visit Summaries before adding to the schedule.",
      },
    ],
  }),
  component: ScanAVS,
});

function ScanAVS() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  const handleUpload = () => {
    setLoading(true);
    setRows([]);
    setTimeout(() => {
      setRows(MOCK_PARSED_ROWS);
      setLoading(false);
    }, 1500);
  };

  const handleChange = (id: string, field: keyof Omit<ParsedRow, "id">, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleApprove = () => {
    toast.success("Added to schedule", {
      description: `${rows.length} medication${rows.length === 1 ? "" : "s"} added.`,
      duration: 4000,
    });
    setRows([]);
  };

  const handleReject = () => {
    toast("Discarded parsed results", { duration: 3000 });
    setRows([]);
  };

  const hasResults = rows.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Human-in-the-loop
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Scan AVS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an After Visit Summary, verify each parsed row, then approve.
        </p>
      </header>

      <Dropzone loading={loading} onUpload={handleUpload} />

      {hasResults && (
        <>
          <div className="mt-6 mb-3 flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
            <p className="text-xs leading-relaxed text-foreground/90">
              Verify each entry against the physical AVS before approving. CareSync does not
              validate clinical accuracy.
            </p>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Parsed Results</h2>
            <span className="text-xs text-muted-foreground">{rows.length} rows</span>
          </div>

          <ParsedResultsTable rows={rows} onChange={handleChange} />

          <div className="sticky bottom-20 mt-6 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur md:bottom-4 md:flex-row">
            <button
              type="button"
              onClick={handleReject}
              className="touch-target flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4" />
              Reject / Edit
            </button>
            <button
              type="button"
              onClick={handleApprove}
              className="touch-target flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[var(--success)] px-4 text-base font-semibold text-[var(--success-foreground)] shadow-sm transition-opacity hover:opacity-90"
            >
              <Check className="h-5 w-5" />
              Approve & Add to Schedule
            </button>
          </div>
        </>
      )}
    </div>
  );
}
