import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CharacterRig } from '../../types/rig';
import type { CharacterReaction } from '../../types/character';
import { EMOTION_CONFIG } from '../../types/emotion';
import type { Emotion } from '../../types/emotion';
import { useExpressionMotion } from './useExpressionMotion';
import { getRigExpressionPose } from './rigExpressionPose';
import { ExpressionAccents } from './ExpressionFeatures';
import './RiggedCharacter.css';

interface Props { rig: CharacterRig; reaction: CharacterReaction; isTalking?: boolean; isThinking?: boolean; reactionId?: number }

export default function RiggedCharacter({ rig, reaction, isTalking = false, isThinking = false, reactionId = 0 }: Props) {
  const motion = useExpressionMotion(reaction, reactionId, isThinking, isTalking);
  const emotion = isThinking ? 'neutral' : reaction.emotion;
  const visualEmotion = isThinking ? 'thinking' : emotion;
  const speaking = isTalking && !isThinking;
  const expression = rig.expressions?.[emotion];
  const fallback = rig.expressions?.[EMOTION_CONFIG[emotion].fallback as Emotion];
  const [mouthFrame, setMouthFrame] = useState(0);
  useEffect(() => {
    if (!speaking) return;
    const timer = setInterval(() => setMouthFrame(prev => (prev + 1) % 4), 150);
    return () => clearInterval(timer);
  }, [speaking]);

  const mouthImages = rig.mouthVariants;
  const talkingImage = speaking && mouthImages
    ? [mouthImages.closed, mouthImages.half, mouthImages.open, mouthImages.half][mouthFrame]
    : null;
  const eyes = rig.parts.filter(part => part.type === 'eyes').map(part => ({
    x: part.x + part.width / 2, y: part.y + part.height / 2,
  })).sort((a, b) => a.x - b.x);
  const left = eyes[0];
  const right = eyes.at(-1);
  const hasFaceAnchors = left && right && right.x - left.x > 0;

  return (
    <div ref={motion.ref} className={`rigged-character ${motion.className}`}
      data-emotion={reaction.emotion} data-expression={visualEmotion} role="img"
      aria-label={`커스텀 캐릭터: ${isThinking ? '생각하는 중' : EMOTION_CONFIG[reaction.emotion].label}`}
      style={{ ...motion.style, position: 'relative', width: '100%', aspectRatio: `${rig.canvas.width} / ${rig.canvas.height}`, isolation: 'isolate', userSelect: 'none' }}>
      {rig.parts.map(part => {
        const isMouth = part.type === 'mouth' || part.id === 'mouth';
        const explicit = expression?.[part.id] ?? part.variants?.[emotion];
        const fallbackSrc = fallback?.[part.id];
        const openExpression = isMouth && !speaking && !explicit && ['excited', 'surprised'].includes(emotion) ? mouthImages?.open : undefined;
        const image = (isMouth ? talkingImage : null) ?? explicit ?? openExpression ?? fallbackSrc ?? part.src;
        const poseEmotion = isThinking ? 'thinking' : explicit || (isMouth && speaking) || openExpression ? 'neutral' : emotion;
        const pose = getRigExpressionPose(part, poseEmotion, rig.canvas.width);
        const style = {
          position: 'absolute', left: `${part.x / rig.canvas.width * 100}%`,
          top: `${part.y / rig.canvas.height * 100}%`, width: `${part.width / rig.canvas.width * 100}%`,
          height: `${part.height / rig.canvas.height * 100}%`,
          transformOrigin: `${part.pivotX * 100}% ${part.pivotY * 100}%`,
          zIndex: part.zIndex, pointerEvents: 'none',
          '--part-x': `${pose.x}%`, '--part-y': `${pose.y}%`,
          '--part-angle': `${pose.angle}deg`, '--part-sx': pose.sx, '--part-sy': pose.sy,
        } as CSSProperties;
        return <img key={part.id} src={image} alt="" draggable={false}
          className={`rig-part rig-part-${part.type}${isMouth && speaking && !talkingImage ? ' rig-part-talking' : ''}`}
          data-part={part.id} data-type={part.type} style={style} />;
      })}
      {hasFaceAnchors && !isThinking && (
        <svg viewBox={`0 0 ${rig.canvas.width} ${rig.canvas.height}`} className="rig-expression-layer" aria-hidden="true">
          <ExpressionAccents emotion={emotion} x={(left.x + right.x) / 2} y={(left.y + right.y) / 2}
            scale={(right.x - left.x) / 56} intensity={motion.intensity} />
        </svg>
      )}
    </div>
  );
}
