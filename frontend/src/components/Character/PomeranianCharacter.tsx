import { useEffect, useState } from 'react';

import type { Emotion } from '../../types/emotion';

import './PomeranianCharacter.css';

const BASE = '/character/pomeranian/';

interface PomeranianCharacterProps {
    emotion?: Emotion;
    isTalking?: boolean;
  }

  export default function PomeranianCharacter({
    emotion = 'neutral',
    isTalking = false,
  }: PomeranianCharacterProps) {
    const [isBlinking, setIsBlinking] = useState(false);
    const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    let blinkTimer: ReturnType<typeof setTimeout>;
    let reopenTimer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const scheduleBlink = () => {
      blinkTimer = setTimeout(() => {
        if (stopped) return;

        setIsBlinking(true);

        reopenTimer = setTimeout(() => {
          if (stopped) return;

          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, 2500 + Math.random() * 2000);
    };

    scheduleBlink();

    return () => {
      stopped = true;
      clearTimeout(blinkTimer);
      clearTimeout(reopenTimer);
    };
  }, []);

  // AI가 말하는 동안 입을 열고 닫기
    useEffect(() => {
        if (!isTalking) {
        setMouthOpen(false);
        return;
        }
    
        const interval = setInterval(() => {
        setMouthOpen((prev) => !prev);
        }, 220);
    
        return () => clearInterval(interval);
    }, [isTalking]);

  // 감정에 따른 눈 변경
  const getEyes = () => {
    if (isBlinking) return 'eyes_closed.png';

    switch (emotion) {
      case 'happy':
      case 'excited':
        return 'eyes_happy.png';

      case 'surprised':
        return 'eyes_surprised.png';

        case 'sad':
         return 'eyes_sad.png';

      default:
        return 'eyes_open.png';
    }
  };

  // 감정에 따른 입 변경
  const getMouth = () => {
    switch (emotion) {
      case 'happy':
      case 'excited':
        return 'mouth_happy.png';

      case 'surprised':
        return 'mouth_surprised.png';

        case 'sad':
        return 'mouth_sad.png';

      default:
        return 'mouth_idle.png';
    }
  };

  return (
    <div className="pomeranian-container">
      <div className={`pomeranian-character emotion-${emotion}`}>

        {/* 꼬리 */}
        <img
          src={`${BASE}tail.png`}
          className="pomeranian-part pomeranian-tail"
          alt=""
        />

        {/* 몸통 */}
        <img
          src={`${BASE}base.png`}
          className="pomeranian-part pomeranian-base"
          alt=""
        />

        {/* 눈 */}
        {[
        'eyes_open.png',
        'eyes_closed.png',
        'eyes_happy.png',
        'eyes_surprised.png',
        'eyes_sad.png',
        ].map((file) => (
        <img
            key={file}
            src={`${BASE}${file}`}
            className={`pomeranian-part pomeranian-eyes ${
            getEyes() === file ? 'is-active' : ''
            }`}
            alt=""
        />
        ))}
        

        {/* 코 */}
        <img
          src={`${BASE}nose.png`}
          className="pomeranian-part pomeranian-nose"
          alt=""
        />

        {/* 입 */}
        {[
        'mouth_idle.png',
        'mouth_happy.png',
        'mouth_surprised.png',
        'mouth_sad.png',
        ].map((file) => {
        const currentMouth =
            isTalking && mouthOpen
            ? 'mouth_happy.png'
            : getMouth();

        return (
            <img
            key={file}
            src={`${BASE}${file}`}
            className={`pomeranian-part pomeranian-mouth ${
                currentMouth === file ? 'is-active' : ''
            }`}
            alt=""
            />
        );
        })}

      </div>
    </div>
  );
}