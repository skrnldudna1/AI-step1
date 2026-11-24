import type { CharacterReaction } from '../../types/character';
import { EMOTION_CONFIG } from '../../types/emotion';
import { ExpressionEye, ExpressionMouth, ExpressionAccents } from './ExpressionFeatures';
import { useExpressionMotion } from './useExpressionMotion';
import './BasicCharacter.css';

interface CharacterProps {
  reaction: CharacterReaction;
  isThinking: boolean;
  isTalking: boolean;
  reactionId: number;
}

export default function BasicCharacter({ reaction, isThinking, isTalking, reactionId }: CharacterProps) {
  const motion = useExpressionMotion(reaction, reactionId, isThinking, isTalking);
  const displayEmotion = isThinking ? 'thinking' : reaction.emotion;
  return (
    <div className="character-container">
      <div ref={motion.ref} className={`character-face ${motion.className}`} style={motion.style}
        data-emotion={reaction.emotion} data-expression={displayEmotion} role="img"
        aria-label={`기본 캐릭터: ${isThinking ? '생각하는 중' : EMOTION_CONFIG[reaction.emotion].label}`}>
        <svg viewBox="0 0 200 200" className="basic-face-features" aria-hidden="true">
          <ExpressionAccents emotion={displayEmotion} x={100} y={83} intensity={motion.intensity} />
          <ExpressionEye emotion={displayEmotion} side="left" x={72} y={83} autoBlink />
          <ExpressionEye emotion={displayEmotion} side="right" x={128} y={83} autoBlink />
          <ExpressionMouth emotion={displayEmotion} x={100} y={127} talking={isTalking && !isThinking} />
        </svg>
      </div>
    </div>
  );
}
