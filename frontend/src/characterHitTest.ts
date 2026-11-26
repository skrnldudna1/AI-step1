import { pointInPolygon } from './headRig';
import type { ClipPolygon } from './headRig';
// Hit-test the visible character pixels, not its rectangular window.
type Point = { x: number; y: number };
type AlphaMask = { width: number; height: number; alpha: Uint8Array };
type MaskEntry = AlphaMask | 'loading' | 'unavailable';

const masks = new Map<string, MaskEntry>();
const ALPHA_THRESHOLD = 24;
const MAX_MASK_DIMENSION = 1024;
const MAX_CACHED_MASKS = 64;

function rememberMask(key: string, mask: MaskEntry) {
  masks.delete(key);
  masks.set(key, mask);
  while (masks.size > MAX_CACHED_MASKS) {
    const oldest = masks.keys().next().value;
    if (oldest === undefined) break;
    masks.delete(oldest);
  }
}

function readAlpha(image: HTMLImageElement): AlphaMask {
  // Limit memory while maintaining detail for desktop-sized characters.
  const scale = Math.min(1, MAX_MASK_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return { width, height, alpha };
}

function getMask(image: HTMLImageElement): MaskEntry {
  const key = image.currentSrc || image.src;
  const cached = masks.get(key);
  if (cached !== undefined) return cached;
  try {
    const mask = readAlpha(image);
    rememberMask(key, mask);
    return mask;
  } catch {
    // Generated rig images are served by FastAPI. Read them with CORS
    // separately, without changing how the existing renderer loads images.
    rememberMask(key, 'loading');
    const clone = new Image();
    clone.crossOrigin = 'anonymous';
    clone.onload = () => {
      try {
        rememberMask(key, readAlpha(clone));
      } catch {
        rememberMask(key, 'unavailable');
      }
    };
    clone.onerror = () => rememberMask(key, 'unavailable');
    clone.src = key;
    return 'loading';
  }
}

export function prepareCharacterImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    getMask(image);
  }
}

// Convert a viewport point to the element's untransformed border box.
// CSS zoom is uniform; deriving it from the real bounding box also accounts
// for nested STEP 15 size scaling and Retina display-independent coordinates.
export function localCharacterPoint(element: HTMLElement, point: Point) {
  const rect = element.getBoundingClientRect();
  if (point.x < rect.left || point.x >= rect.right ||
      point.y < rect.top || point.y >= rect.bottom) return null;

  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!width || !height) return null;

  let matrix = new DOMMatrix();
  let opacity = 1;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility !== 'visible') return null;
    opacity *= Number(style.opacity);
    if (opacity * 255 < ALPHA_THRESHOLD) return null;
    if (style.transform !== 'none') {
      matrix = new DOMMatrix(style.transform).multiply(matrix);
    }
  }

  // Translations and transform origins are already represented by rect.center.
  const { a, b, c, d } = matrix;
  const transformedWidth = Math.abs(a) * width + Math.abs(c) * height;
  const zoom = rect.width / transformedWidth;
  if (!Number.isFinite(zoom) || zoom <= 0) return null;
  const inverse = new DOMMatrix([a, b, c, d, 0, 0]).inverse();
  const local = inverse.transformPoint(new DOMPoint(
    (point.x - rect.left - rect.width / 2) / zoom,
    (point.y - rect.top - rect.height / 2) / zoom,
  ));
  const x = local.x + width / 2;
  const y = local.y + height / 2;
  if (!Number.isFinite(x) || !Number.isFinite(y) ||
      x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y, width, height, opacity };
}

function imagePixelHit(image: HTMLImageElement, point: Point): boolean {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return false;
  const local = localCharacterPoint(image, point);
  if (!local) return false;
  if (image.dataset.hitPolygon) {
    try {
      const polygon = JSON.parse(image.dataset.hitPolygon) as ClipPolygon;
      if (!pointInPolygon(local.x / local.width * 100, local.y / local.height * 100, polygon)) return false;
    } catch { return false; }
  }
  let { x, y, width, height } = local;
  // Pomeranian and illustration use object-fit: contain; rig parts use fill.
  const objectFit = getComputedStyle(image).objectFit;
  if (objectFit === 'contain' || objectFit === 'cover') {
    const ratio = (objectFit === 'contain' ? Math.min : Math.max)(
      width / image.naturalWidth, height / image.naturalHeight,
    );
    const fittedWidth = image.naturalWidth * ratio;
    const fittedHeight = image.naturalHeight * ratio;
    x -= (width - fittedWidth) / 2;
    y -= (height - fittedHeight) / 2;
    width = fittedWidth;
    height = fittedHeight;
  }
  if (x < 0 || y < 0 || x >= width || y >= height) return false;

  const mask = getMask(image);
  if (mask === 'loading') return false;
  // A remote image that disallows reading its pixels remains draggable.
  // Its visible image rectangle is used as the limited fallback.
  if (mask === 'unavailable') return true;
  const column = Math.min(mask.width - 1, Math.floor(x / width * mask.width));
  const row = Math.min(mask.height - 1, Math.floor(y / height * mask.height));
  return mask.alpha[row * mask.width + column] * local.opacity >= ALPHA_THRESHOLD;
}

function meshPixelHit(mesh: HTMLCanvasElement, point: Point): boolean {
    const local = localCharacterPoint(mesh, point);
    if (!local) return false;
    const gl = mesh.getContext('webgl');
    if (!gl || gl.isContextLost()) return false;
    const pixel = new Uint8Array(4);
    const x = Math.min(mesh.width - 1, Math.floor(local.x / local.width * mesh.width));
    const y = Math.min(mesh.height - 1, Math.floor(local.y / local.height * mesh.height));
    gl.readPixels(x, mesh.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel[3] * local.opacity >= ALPHA_THRESHOLD;
}

export function isCharacterPixel(root: HTMLElement, point: Point): boolean {
  // Both outgoing and incoming artwork may be visible during a crossfade.
  // Invisible layers are rejected by localCharacterPoint's opacity check.
  if (Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas[data-mesh-active="true"]')).some(mesh => meshPixelHit(mesh, point))) return true;
  const face = root.querySelector<HTMLElement>('.character-face');
  if (face) {
    const local = localCharacterPoint(face, point);
    if (!local) return false;
    const x = local.x / local.width * 2 - 1;
    const y = local.y / local.height * 2 - 1;
    return x * x + y * y <= 1;
  }

  // Each visible layer (body, tail, eyes, mouth, rig parts) is checked
  // independently, including the actual current transform and opacity.
  return Array.from(root.querySelectorAll<HTMLImageElement>('img'))
    .some((image) => imagePixelHit(image, point));
}
