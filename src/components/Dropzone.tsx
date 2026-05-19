import { useRef } from "react";
import { Upload, Camera, Loader2 } from "lucide-react";

interface DropzoneProps {
  loading:      boolean;
  onFileSelect: (file: File) => void;
}

export function Dropzone({ loading, onFileSelect }: DropzoneProps) {
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="sr-only"
        onChange={handleChange}
      />

      {/* Upload from files */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="touch-target group flex min-h-[150px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-card/40 p-6 text-center transition-colors hover:border-foreground/40 hover:bg-card disabled:cursor-wait"
        style={{ boxShadow: "var(--card-shadow)" }}
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
              <p className="text-sm font-medium text-foreground">Upload AVS Document</p>
              <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP, HEIC, or PDF — tap to select</p>
            </div>
          </>
        )}
      </button>

      {/* Take photo with device camera (mobile) */}
      {!loading && (
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="touch-target flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          style={{ boxShadow: "var(--card-shadow)" }}
        >
          <Camera className="h-4 w-4 text-muted-foreground" />
          Take Photo with Camera
        </button>
      )}
    </div>
  );
}
