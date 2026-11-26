import type { CharacterReaction } from '../../types/character';
import { EMOTION_CONFIG } from '../../types/emotion';
import { useExpressionMotion } from './useExpressionMotion';
import { clipPath, horizontalSplit } from '../../headRig';
import './ExpressionFeatures.css';
import './ImageCharacter.css';

interface Props { reaction: CharacterReaction; isThinking: boolean; isTalking: boolean; reactionId: number }

export default function ImageCharacter({ reaction, isThinking, isTalking, reactionId }: Props) {
  const motion = useExpressionMotion(reaction, reactionId, isThinking, isTalking);
  const file = isThinking ? 'thinking.png' : EMOTION_CONFIG[reaction.emotion].illustration;
  const movingHead = isThinking || reaction.action === 'nod' || reaction.action === 'shake' ||
    (reaction.action === 'idle' && (isTalking || ['confused', 'shy', 'playful'].includes(reaction.emotion)));
  const split = horizontalSplit(75, movingHead ? 7 : 0);
  const opaque = ['angry.png', 'sad.png', 'playful.png', 'affectionate.png'].includes(file);
  const artSrc = `/character/${file}`;
  const fallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (!event.currentTarget.src.endsWith('/neutral.png')) event.currentTarget.src = '/character/neutral.png';
  };
  return (
    <div className="image-character-container">
      <div ref={motion.ref} className={`image-character has-head-rig ${motion.className}`} style={motion.style}
        data-emotion={reaction.emotion} data-expression={isThinking ? 'thinking' : reaction.emotion}
        role="img" aria-label={`일러스트 캐릭터: ${isThinking ? '생각하는 중' : EMOTION_CONFIG[reaction.emotion].label}`}>
        <div className={`illustration-rig-frame${opaque ? ' is-opaque' : ''}`}>
        <img className="image-character-body" src={artSrc} alt="" draggable={false} onError={fallback}
          style={{ clipPath: clipPath(split.body) }} data-hit-polygon={JSON.stringify(split.body)} />
        <div className="companion-head-layer illustration-head" data-head-pivot="56,73">
        <img className="image-character-art" src={artSrc} alt="" draggable={false} onError={fallback}
          style={{ clipPath: clipPath(split.head) }} data-hit-polygon={JSON.stringify(split.head)} />
        {!isThinking && reaction.emotion === 'affectionate' && (
          <svg viewBox="0 0 384 512" className="illustration-expression-effects" aria-hidden="true">
            <g className="expression-hearts" fill="#ec92ad" opacity={.45 + motion.intensity * .55}>
              <path d="M321 70 C306 55 290 76 321 96 C352 76 336 55 321 70Z"/>
              <path d="M350 38 C341 28 331 42 350 55 C369 42 359 28 350 38Z"/>
            </g>
          </svg>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
