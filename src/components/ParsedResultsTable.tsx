import type { ParsedRow } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ParsedResultsTableProps {
  rows: ParsedRow[];
  onChange: (id: string, field: keyof Omit<ParsedRow, "id">, value: string) => void;
}

export function ParsedResultsTable({ rows, onChange }: ParsedResultsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="px-3">Medication</TableHead>
            <TableHead className="px-3">Dosage</TableHead>
            <TableHead className="px-3">Frequency</TableHead>
            <TableHead className="px-3">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-border">
              {(["medication", "dosage", "frequency", "time"] as const).map((field) => (
                <TableCell key={field} className="px-1 py-1">
                  <input
                    value={row[field]}
                    onChange={(e) => onChange(row.id, field, e.target.value)}
                    className="w-full rounded-md bg-transparent px-2 py-2 text-sm text-foreground outline-none transition-colors hover:bg-accent focus:bg-accent focus:ring-1 focus:ring-ring"
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
