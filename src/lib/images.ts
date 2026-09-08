const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("image_type_not_allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("image_too_large");
}

export async function resizeImage(
  file: File,
  maximumWidth: number,
  maximumHeight: number,
  quality: number,
): Promise<Blob> {
  validateImageFile(file);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maximumWidth / bitmap.width, maximumHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_processing_failed");
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("image_processing_failed")),
        "image/webp",
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}
