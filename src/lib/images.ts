/**
 * Photo attachments. Images are downscaled and re-encoded as JPEG in the browser, then kept as
 * data URLs: small enough to store in IndexedDB and send to Gemini as inline data.
 */
import { useCallback, useRef, useState } from 'react';

export const MAX_IMAGES = 4;
const MAX_SIDE = 1280;
const QUALITY = 0.82;

/** Downscales an image file to a JPEG data URL. */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`“${file.name}” isn’t an image.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn’t read “${file.name}”. Try a JPEG or PNG.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', QUALITY);
}

/** Splits a data URL into the shape Firebase AI Logic expects for an inline image part. */
export function toInlineData(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('Invalid image data.');
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

/** Image files from a paste or drop event. */
export function imageFiles(list: DataTransferItemList | FileList | null | undefined): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (const item of Array.from(list as ArrayLike<DataTransferItem | File>)) {
    const f = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null;
    if (f && f.type.startsWith('image/')) out.push(f);
  }
  return out;
}

/** State for a composer's attached photos. */
export function useImageAttachments(onError: (message: string) => void) {
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const count = useRef(0);
  count.current = images.length;

  const add = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      try {
        const urls: string[] = [];
        for (const f of files) {
          try {
            urls.push(await compressImage(f));
          } catch (e) {
            onError(e instanceof Error ? e.message : 'Couldn’t add that image.');
          }
        }
        if (count.current + urls.length > MAX_IMAGES) onError(`You can attach up to ${MAX_IMAGES} photos per message.`);
        setImages((cur) => [...cur, ...urls].slice(0, MAX_IMAGES));
      } finally {
        setBusy(false);
      }
    },
    [onError],
  );
  const remove = useCallback((i: number) => setImages((cur) => cur.filter((_, j) => j !== i)), []);
  const clear = useCallback(() => setImages([]), []);

  return { images, busy, add, remove, clear };
}
