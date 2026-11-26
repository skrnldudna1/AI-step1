import { useEffect, useState } from 'react';
import { artworkSources, FULL_ARTWORK } from './expressionTransition';
import type { ArtworkBounds, ArtworkSlot } from './expressionTransition';

const loadedImages = new Map<string, Promise<ArtworkBounds>>();

function alphaBounds(image: HTMLImageElement): ArtworkBounds {
  try {
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return FULL_ARTWORK;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] < 32) continue;
      x0 = Math.min(x0,x); x1 = Math.max(x1,x); y0 = Math.min(y0,y); y1 = Math.max(y1,y);
    }
    return x1 >= x0 && y1 >= y0 ? { x:x0/canvas.width, y:y0/canvas.height, width:(x1-x0+1)/canvas.width, height:(y1-y0+1)/canvas.height } : FULL_ARTWORK;
  } catch { return FULL_ARTWORK; }
}

function preloadImage(src: string): Promise<ArtworkBounds> {
  const cached = loadedImages.get(src);
  if (cached) return cached;
  const result = new Promise<ArtworkBounds>((resolve, reject) => {
    const load = (cors: boolean) => {
      const image = new Image();
      if (cors) image.crossOrigin = 'anonymous';
      image.onload = () => resolve(alphaBounds(image));
      image.onerror = () => cors ? load(false) : reject(new Error('표정 이미지 로드 실패'));
      image.src = src;
    };
    load(true);
  });
  loadedImages.set(src, result);
  result.catch(() => loadedImages.delete(src));
  while (loadedImages.size > 32) loadedImages.delete(loadedImages.keys().next().value!);
  return result;
}

export function usePreloadedArtwork(slots: ArtworkSlot[]) {
  const [ready, setReady] = useState<Record<string, ArtworkBounds>>({});
  useEffect(() => {
    let live = true;
    for (const slot of slots) {
      const sources = artworkSources(slot.rig);
      if (!sources.length) continue;
      Promise.all(sources.map(preloadImage)).then(results => {
        if (live) setReady(prev => ({ ...prev, [slot.key]: slot.rig.mesh ? results[0] : FULL_ARTWORK }));
      }).catch(() => {}); // Unavailable references never hide the primary art.
    }
    return () => { live = false; };
  }, [slots]);
  return ready;
}
