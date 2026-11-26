import type { CharacterRig } from '../../types/rig';
import type { Emotion } from '../../types/emotion';

export const EXPRESSION_FADE_MS = 260;
export type ArtworkBounds = { x: number; y: number; width: number; height: number };
export const FULL_ARTWORK: ArtworkBounds = { x: 0, y: 0, width: 1, height: 1 };
export type ArtworkSlot = { key: string; emotion: Emotion | null; rig: CharacterRig };

export function getArtworkSlots(primary: CharacterRig): ArtworkSlot[] {
  return [{ key: 'primary', emotion: null, rig: primary }, ...Object.entries(primary.expressionRigs ?? {})
    .filter(([, rig]) => rig && rig.id && rig.canvas.width > 0 && rig.canvas.height > 0)
    .map(([emotion, rig]) => ({ key: emotion, emotion: emotion as Emotion, rig: rig! }))];
}

export function selectArtworkSlot(slots: ArtworkSlot[], emotion: Emotion, thinking: boolean, ready: ReadonlySet<string>) {
  if (!thinking && emotion !== 'neutral' && ready.has(emotion)) {
    const slot = slots.find(slot => slot.key === emotion);
    if (slot) return slot;
  }
  return slots[0];
}

export function artworkSources(rig: CharacterRig): string[] {
  return [...new Set(rig.mesh?.src ? [rig.mesh.src] : rig.parts.map(part => part.src))].filter(Boolean);
}

// All art stays in the representative character's fixed canvas. Fit the
// independent reference without stretching and, where possible, align its
// visible subject instead of the transparent margins surrounding it.
export function fitArtwork(primary: CharacterRig['canvas'], sample: CharacterRig['canvas'], mainBounds = FULL_ARTWORK, sampleBounds = FULL_ARTWORK) {
  const mainW = primary.width, mainH = primary.height, w = sample.width, h = sample.height;
  const fit = Math.min(mainW/w, mainH/h);
  const subjectFit = Math.min(mainW*mainBounds.width/(w*sampleBounds.width), mainH*mainBounds.height/(h*sampleBounds.height));
  const scale = Math.max(fit*.8, Math.min(fit*1.35, subjectFit));
  const subjectCenter = mainW*(mainBounds.x+mainBounds.width/2);
  const left = subjectCenter - w*(sampleBounds.x+sampleBounds.width/2)*scale;
  const bottom = mainH*(1-mainBounds.y-mainBounds.height) - h*(1-sampleBounds.y-sampleBounds.height)*scale;
  return { width: `${w*scale/mainW*100}%`, left: `${(left+w*scale/2)/mainW*100}%`, bottom: `${bottom/mainH*100}%`, aspectRatio: `${w} / ${h}` };
}
