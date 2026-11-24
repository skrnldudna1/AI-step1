import type { CharacterReaction } from '../../types/character';
import { EMOTION_CONFIG } from '../../types/emotion';
import { useExpressionMotion } from './useExpressionMotion';
import './ExpressionFeatures.css';
import './ImageCharacter.css';

interface Props { reaction: CharacterReaction; isThinking: boolean; isTalking: boolean; reactionId: number }

export default function ImageCharacter({ reaction, isThinking, isTalking, reactionId }: Props) {
  const motion = useExpressionMotion(reaction, reactionId, isThinking, isTalking);
  const file = isThinking ? 'thinking.png' : EMOTION_CONFIG[reaction.emotion].illustration;
  return (
    <div className="image-character-container">
      <div ref={motion.ref} className={`image-character ${motion.className}`} style={motion.style}
        data-emotion={reaction.emotion} data-expression={isThinking ? 'thinking' : reaction.emotion}>
        <img className="image-character-art" src={`/character/${file}`}
          alt={`일러스트 캐릭터: ${isThinking ? '생각하는 중' : EMOTION_CONFIG[reaction.emotion].label}`} draggable={false}
          onError={event => { if (!event.currentTarget.src.endsWith('/neutral.png')) event.currentTarget.src = '/character/neutral.png'; }} />
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
  );
}
