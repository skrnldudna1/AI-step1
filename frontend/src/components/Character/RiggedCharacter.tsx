import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CharacterRig, RigPart } from '../../types/rig';
import type { CharacterReaction } from '../../types/character';
import { EMOTION_CONFIG } from '../../types/emotion';
import type { Emotion, VisualEmotion } from '../../types/emotion';
import { useExpressionMotion } from './useExpressionMotion';
import { getRigExpressionPose } from './rigExpressionPose';
import { ExpressionAccents } from './ExpressionFeatures';
import MeshRigCharacter from './MeshRigCharacter';
import { EXPRESSION_FADE_MS, fitArtwork, FULL_ARTWORK, getArtworkSlots, selectArtworkSlot } from './expressionTransition';
import { usePreloadedArtwork } from './usePreloadedArtwork';
import { clipPath, getRigHeadPlan, horizontalSplit, isHeadPart } from '../../headRig';
import type { ClipPolygon } from '../../headRig';
import './RiggedCharacter.css';

interface Props { rig: CharacterRig; reaction: CharacterReaction; isTalking?: boolean; isThinking?: boolean; reactionId?: number }

interface ArtProps {
  rig: CharacterRig; reaction: CharacterReaction; visualEmotion: VisualEmotion; isTalking: boolean;
  reactionId: number; running: boolean; preserveExpression: boolean; frame: CSSProperties;
}

function RigArtwork({ rig, reaction, visualEmotion, isTalking, reactionId, running, preserveExpression, frame }: ArtProps) {
  const isThinking = visualEmotion === 'thinking';
  const emotion: Emotion = isThinking ? 'neutral' : visualEmotion;
  const speaking = isTalking && running && !isThinking && !preserveExpression;
  const expression = preserveExpression ? undefined : rig.expressions?.[emotion];
  const fallback = preserveExpression ? undefined : rig.expressions?.[EMOTION_CONFIG[emotion].fallback as Emotion];
  const [mouthFrame, setMouthFrame] = useState(0);
  const mouthImages = preserveExpression ? null : rig.mouthVariants;
  useEffect(() => {
    if (!speaking || !mouthImages) return;
    const timer = setInterval(() => setMouthFrame(prev => (prev + 1) % 4), 150);
    return () => clearInterval(timer);
  }, [speaking, mouthImages]);

  const talkingImage = speaking && mouthImages
    ? [mouthImages.closed, mouthImages.half, mouthImages.open, mouthImages.half][mouthFrame]
    : null;
  const eyes = rig.parts.filter(part => part.type === 'eyes').map(part => ({
    x: part.x + part.width / 2, y: part.y + part.height / 2,
  })).sort((a, b) => a.x - b.x);
  const left = eyes[0];
  const right = eyes.at(-1);
  const hasFaceAnchors = left && right && right.x - left.x > 0;
  const headPlan = getRigHeadPlan(rig);
  const splitHead = headPlan.mode !== 'whole';
  const base = headPlan.base;
  const movingHead = isThinking || reaction.action === 'nod' || reaction.action === 'shake' ||
    (reaction.action === 'idle' && ['confused', 'shy', 'playful'].includes(reaction.emotion));
  const masks = headPlan.mode === 'clipped' && base
    ? horizontalSplit((headPlan.neckY / 100 * rig.canvas.height - base.y) / base.height * 100, movingHead ? 6 : 0)
    : null;

  const renderPart = (part: RigPart, clip?: ClipPolygon, suffix = '') => {
        const isMouth = part.type === 'mouth' || part.id === 'mouth';
        const explicit = preserveExpression ? undefined : expression?.[part.id] ?? part.variants?.[emotion];
        const fallbackSrc = fallback?.[part.id];
        const openExpression = isMouth && !speaking && !explicit && ['excited', 'surprised'].includes(emotion) ? mouthImages?.open : undefined;
        const image = (isMouth ? talkingImage : null) ?? explicit ?? openExpression ?? fallbackSrc ?? part.src;
        const preserveFace = preserveExpression && ['eyes', 'eyebrow', 'mouth', 'nose'].includes(part.type);
        const poseEmotion = preserveFace || explicit || (isMouth && speaking) || openExpression ? 'neutral' : visualEmotion;
        const pose = getRigExpressionPose(part, poseEmotion, rig.canvas.width);
        const side = part.id.includes('left') || (!part.id.includes('right') && part.x + part.width / 2 < rig.canvas.width / 2) ? -1 : 1;
        const style = {
          position: 'absolute', left: `${part.x / rig.canvas.width * 100}%`,
          top: `${part.y / rig.canvas.height * 100}%`, width: `${part.width / rig.canvas.width * 100}%`,
          height: `${part.height / rig.canvas.height * 100}%`,
          transformOrigin: `${part.pivotX * 100}% ${part.pivotY * 100}%`,
          zIndex: part.zIndex, pointerEvents: 'none',
          '--part-x': `${pose.x}%`, '--part-y': `${pose.y}%`,
          '--part-angle': `${pose.angle}deg`, '--part-sx': pose.sx, '--part-sy': pose.sy,
          '--arm-swing': `${side * (emotion === 'excited' ? 8 : 4)}deg`,
          '--leg-swing': `${side * (emotion === 'excited' ? 7 : 4)}deg`,
          ...(clip ? { clipPath: clipPath(clip) } : {}),
        } as CSSProperties;
        return <img key={rig.id + part.id + suffix} src={image} alt="" draggable={false}
          className={`rig-part rig-part-${part.type}${isMouth && speaking && !talkingImage ? ' rig-part-talking' : ''}`}
          data-part={part.id} data-type={part.type} style={style}
          data-hit-polygon={clip ? JSON.stringify(clip) : undefined} />;
  };
  const accents = !preserveExpression && hasFaceAnchors && !isThinking && (
    <svg viewBox={`0 0 ${rig.canvas.width} ${rig.canvas.height}`} className="rig-expression-layer" aria-hidden="true">
          <ExpressionAccents emotion={emotion} x={(left.x + right.x) / 2} y={(left.y + right.y) / 2}
            scale={(right.x - left.x) / 56} intensity={reaction.intensity} />
    </svg>
  );
  return (
      <div className={`rig-art${preserveExpression ? ' rig-reference-art' : ''}`} style={frame}>
      {rig.mesh ? <MeshRigCharacter key={rig.id} rig={rig} reaction={reaction}
        emotion={visualEmotion} talking={isTalking && running && !isThinking} reactionId={reactionId} active={running} preserveExpression={preserveExpression} /> : splitHead ? <>
        {rig.parts.filter(part => !isHeadPart(part, headPlan, rig.canvas.height)).map(part =>
          renderPart(part, part === base && masks ? masks.body : undefined, '-body'))}
        <div className="companion-head-layer rig-head-layer" style={{ transformOrigin: `${headPlan.pivotX}% ${headPlan.pivotY}%` }}>
          {masks && base && renderPart(base, masks.head, '-head')}
          {rig.parts.filter(part => isHeadPart(part, headPlan, rig.canvas.height)).map(part => renderPart(part))}
          {accents}
        </div>
      </> : <>{rig.parts.map(part => renderPart(part))}{accents}</>}
      </div>
  );
}

function RiggedCharacterScene({ rig: primary, reaction, isTalking = false, isThinking = false, reactionId = 0 }: Props) {
  const motion = useExpressionMotion(reaction, reactionId, isThinking, isTalking);
  const slots = useMemo(() => getArtworkSlots(primary), [primary]);
  const artwork = usePreloadedArtwork(slots);
  const selected = selectArtworkSlot(slots, reaction.emotion, isThinking, new Set(Object.keys(artwork)));
  const [retained, setRetained] = useState<string[]>(['primary']);
  useEffect(() => {
    setRetained(previous => previous.includes(selected.key) ? previous : [...previous, selected.key]);
    const timer = setTimeout(() => setRetained([selected.key]), EXPRESSION_FADE_MS + 65);
    return () => clearTimeout(timer);
  }, [selected.key]);
  const headPlan = getRigHeadPlan(selected.rig);
  const splitHead = headPlan.mode !== 'whole' || selected.rig.mesh?.regions.some(region => region.id === 'head');
  const visualEmotion = isThinking ? 'thinking' : reaction.emotion;
  return <div ref={motion.ref} className={`rigged-character ${splitHead ? 'has-head-rig' : 'head-only'} ${motion.className}`}
    data-emotion={reaction.emotion} data-expression={visualEmotion} data-head-mode={headPlan.mode} data-reference-expression={selected.emotion ?? undefined} role="img"
    aria-label={`커스텀 캐릭터: ${isThinking ? '생각하는 중' : EMOTION_CONFIG[reaction.emotion].label}`}
    style={{ ...motion.style, position: 'relative', width: '100%', aspectRatio: `${primary.canvas.width} / ${primary.canvas.height}`, isolation: 'isolate', userSelect: 'none' }}>
    {slots.map(slot => {
      const active = slot.key === selected.key;
      const running = active || retained.includes(slot.key);
      const emotion = slot.emotion ?? (active ? visualEmotion : 'neutral');
      const frame = slot.emotion ? fitArtwork(primary.canvas, slot.rig.canvas, artwork.primary ?? FULL_ARTWORK, artwork[slot.key] ?? FULL_ARTWORK)
        : { width: '100%', aspectRatio: `${primary.canvas.width} / ${primary.canvas.height}` };
      return <div className="rig-expression-slot" key={slot.key} data-active={active ? 'true' : 'false'} data-expression-slot={slot.key} aria-hidden="true">
        <RigArtwork rig={slot.rig} reaction={reaction} visualEmotion={emotion} isTalking={active && isTalking} reactionId={reactionId}
          running={running} preserveExpression={!!slot.emotion} frame={frame} />
      </div>;
    })}
  </div>;
}

export default function RiggedCharacter(props: Props) {
  return <RiggedCharacterScene key={props.rig.id} {...props} />;
}
