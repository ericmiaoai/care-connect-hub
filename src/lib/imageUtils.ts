/**
 * imageUtils.ts
 * =============
 * Shared image-processing helpers. Currently provides the centre-crop +
 * compress flow used for both user avatars (settings.tsx) and patient photos
 * (PatientEditSheet.tsx).
 */

/**
 * Centre-crop a File to a square and compress it to a 256×256 JPEG (quality 0.85).
 * Returns a Blob ready for upload to Supabase Storage.
 */
export function compressToAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 256;
      const canvas = document.createElement("canvas");
      canvas.width  = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      // Centre-crop to square before scaling down
      const min = Math.min(img.width, img.height);
      const sx  = (img.width  - min) / 2;
      const sy  = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else      reject(new Error("Failed to compress image"));
      }, "image/jpeg", 0.85);
    };
    img.onerror = reject;
    img.src     = url;
  });
}
