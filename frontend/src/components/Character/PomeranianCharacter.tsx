import { useEffect, useState } from 'react';
import type { CharacterReaction } from '../../types/character';
import { EMOTION_CONFIG } from '../../types/emotion';
import { ExpressionEye, ExpressionMouth, ExpressionAccents } from './ExpressionFeatures';
import { useExpressionMotion } from './useExpressionMotion';
import { clipPath, POM_HEAD_CLIP, POM_BODY_CLIP } from '../../headRig';
import './PomeranianCharacter.css';

const BASE = '/character/pomeranian/';
const EYE_FILES = ['eyes_open.png', 'eyes_closed.png', 'eyes_happy.png', 'eyes_surprised.png', 'eyes_sad.png'];
const MOUTH_FILES = ['mouth_idle.png', 'mouth_happy.png', 'mouth_surprised.png', 'mouth_sad.png'];

interface Props { reaction: CharacterReaction; isTalking: boolean; isThinking: boolean; reactionId: number }

export default function PomeranianCharacter({ reaction, isTalking, isThinking, reactionId }: Props) {
  const motion = useExpressionMotion(reaction, reactionId, isThinking, isTalking);
  const [isBlinking, setIsBlinking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const emotion = isThinking ? 'thinking' : reaction.emotion;
  const speaking = isTalking && !isThinking;
  // Retain the original watercolor sprites for the four original expressions.
  const hasOriginalSprite = ['neutral', 'happy', 'sad', 'surprised'].includes(emotion);

  useEffect(() => {
    let blinkTimer: ReturnType<typeof setTimeout>;
    let reopenTimer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const schedule = () => {
      blinkTimer = setTimeout(() => {
        if (stopped) return;
        setIsBlinking(true);
        reopenTimer = setTimeout(() => {
          if (stopped) return;
          setIsBlinking(false);
          schedule();
        }, 150);
      }, 2600 + Math.random() * 1900);
    };
    schedule();
    return () => { stopped = true; clearTimeout(blinkTimer); clearTimeout(reopenTimer); };
  }, []);

  useEffect(() => {
    if (!speaking) return;
    const timer = setInterval(() => setMouthOpen(prev => !prev), 220);
    return () => clearInterval(timer);
  }, [speaking]);

  const eye = isBlinking ? 'eyes_closed.png' : emotion === 'happy' ? 'eyes_happy.png'
    : emotion === 'sad' ? 'eyes_sad.png' : emotion === 'surprised' ? 'eyes_surprised.png' : 'eyes_open.png';
  const mouth = speaking && mouthOpen ? 'mouth_happy.png' : emotion === 'happy' ? 'mouth_happy.png'
    : emotion === 'sad' ? 'mouth_sad.png' : emotion === 'surprised' ? 'mouth_surprised.png' : 'mouth_idle.png';
  return (
    <div className="pomeranian-container">
      <div ref={motion.ref} style={motion.style} className={`pomeranian-character has-head-rig ${motion.className}`}
        data-emotion={reaction.emotion} data-expression={emotion} role="img"
        aria-label={`포메라니안: ${isThinking ? '생각하는 중' : EMOTION_CONFIG[reaction.emotion].label}`}>
        <img src={BASE + 'tail.png'} className="pomeranian-part pomeranian-tail" alt="" draggable={false} />
        <img src={BASE + 'base.png'} className="pomeranian-part pomeranian-base pomeranian-body" alt="" draggable={false}
          style={{ clipPath: clipPath(POM_BODY_CLIP) }} data-hit-polygon={JSON.stringify(POM_BODY_CLIP)} />
        <div className="companion-head-layer pomeranian-head" data-head-pivot="52,60">
        <img src={BASE + 'base.png'} className="pomeranian-part pomeranian-base pomeranian-head-art" alt="" draggable={false}
          style={{ clipPath: clipPath(POM_HEAD_CLIP) }} data-hit-polygon={JSON.stringify(POM_HEAD_CLIP)} />
        {EYE_FILES.map(file => <img key={file} src={BASE + file} alt="" draggable={false}
          className={`pomeranian-part pomeranian-eyes ${hasOriginalSprite && eye === file ? 'is-active' : ''}`} />)}
        <img src={BASE + 'nose.png'} className="pomeranian-part pomeranian-nose" alt="" draggable={false} />
        {MOUTH_FILES.map(file => <img key={file} src={BASE + file} alt="" draggable={false}
          className={`pomeranian-part pomeranian-mouth ${hasOriginalSprite && mouth === file ? 'is-active' : ''}`} />)}
        <svg className="pomeranian-expression-layer" viewBox="0 0 1024 1024" aria-hidden="true">
          <ExpressionAccents emotion={emotion} x={533} y={422} scale={3.35} intensity={motion.intensity} />
          {!hasOriginalSprite && <>
            <ExpressionEye emotion={emotion} side="left" x={426} y={420} scale={3.1} blink={isBlinking} />
            <ExpressionEye emotion={emotion} side="right" x={640} y={420} scale={3.1} blink={isBlinking} />
            <ExpressionMouth emotion={emotion} x={533} y={470} scale={2.2} talking={speaking} />
          </>}
        </svg>
        </div>
      </div>
    </div>
  );
}
