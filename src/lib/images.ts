const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_DIMENSION = 16_384;
const MAX_IMAGE_PIXELS = 40_000_000;

export function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("image_type_not_allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("image_too_large");
}

type ImageDimensions = { width: number; height: number };

function uint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function pngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24
    || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (startOfFrame.has(marker)) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    offset += length + 2;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): ImageDimensions | null {
  const ascii = (offset: number, value: string) => [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
  if (bytes.length < 30 || !ascii(0, "RIFF") || !ascii(8, "WEBP")) return null;
  if (ascii(12, "VP8X")) {
    return { width: uint24LittleEndian(bytes, 24) + 1, height: uint24LittleEndian(bytes, 27) + 1 };
  }
  if (ascii(12, "VP8L") && bytes[20] === 0x2f) {
    const packed = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(21, true);
    return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(12, "VP8 ") && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  return null;
}

async function validateImageDimensions(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = file.type === "image/png" ? pngDimensions(bytes)
    : file.type === "image/jpeg" ? jpegDimensions(bytes)
      : webpDimensions(bytes);
  if (!dimensions) throw new Error("image_metadata_invalid");
  if (dimensions.width > MAX_IMAGE_DIMENSION
    || dimensions.height > MAX_IMAGE_DIMENSION
    || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new Error("image_dimensions_too_large");
  }
}

export async function resizeImage(
  file: File,
  maximumWidth: number,
  maximumHeight: number,
  quality: number,
): Promise<Blob> {
  validateImageFile(file);
  await validateImageDimensions(file);
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
