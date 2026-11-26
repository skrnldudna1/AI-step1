import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { CharacterReaction } from '../../types/character';

export function useExpressionMotion(reaction: CharacterReaction, reactionId: number, isThinking: boolean, isTalking: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || reactionId === 0 || isThinking) return;
    const layers = [element, ...element.querySelectorAll<HTMLElement>('.companion-head-layer, .rig-part-arm, .rig-part-leg')];
    layers.forEach(layer => { layer.style.animation = 'none'; });
    void element.offsetWidth;
    layers.forEach(layer => { layer.style.animation = ''; });
  }, [reactionId, isThinking]);
  const intensity = Math.min(1, Math.max(0, reaction.intensity));
  const style = { '--bounce-height': `-${5 + intensity * 25}px` } as CSSProperties;
  const className = `emotion-motion emotion-${reaction.emotion} action-${reaction.action}${isThinking ? ' is-thinking' : ''}${isTalking && !isThinking ? ' is-talking' : ''}`;
  return { ref, style, className, intensity };
}
