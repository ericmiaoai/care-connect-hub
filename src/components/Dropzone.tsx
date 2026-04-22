import { useRef } from "react";
import { Upload, Loader2 } from "lucide-react";

interface DropzoneProps {
  loading:      boolean;
  onFileSelect: (file: File) => void;
}

export function Dropzone({ loading, onFileSelect }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = ""; // reset so the same file can be re-selected
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="touch-target group flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-card/40 p-6 text-center transition-colors hover:border-foreground/40 hover:bg-card disabled:cursor-wait"
      >
        {loading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Parsing AVS…</p>
          </>
        ) : (
          <>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent">
              <Upload className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Upload After Visit Summary (AVS)</p>
              <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or PDF — tap to select</p>
            </div>
          </>
        )}
      </button>
    </>
  );
}
