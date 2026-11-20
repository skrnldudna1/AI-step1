
import { useEffect, useRef, useState } from 'react';

import CharacterUploader from './components/CharacterUploader/CharacterUploader';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';
import RiggedCharacter from './components/Character/RiggedCharacter';
import ReactionControls from './components/ReactionControls/ReactionControls';
import Chat from './components/Chat/Chat';

import type { Emotion } from './types/emotion';
import type { Action } from './types/action';
import type {
  CharacterReaction,
  CharacterType,
} from './types/character';
import type { CharacterRig } from './types/rig';

import './App.css';

const CHARACTER_STORAGE_KEY = 'gpt-companion-character';
const CUSTOM_RIG_STORAGE_KEY = 'gpt-companion-custom-rig';

function loadCustomRig(): CharacterRig | null {
  try {
    const saved = localStorage.getItem(CUSTOM_RIG_STORAGE_KEY);

    if (!saved) return null;

    const parsed: unknown = JSON.parse(saved);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('canvas' in parsed) ||
      !('parts' in parsed) ||
      !Array.isArray(parsed.parts)
    ) {
      return null;
    }

    return parsed as CharacterRig;
  } catch {
    return null;
  }
}

function App() {
  // ========================================
  // 1. 캐릭터 상태 관리
  // ========================================

  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [action, setAction] = useState<Action>('idle');
  const [intensity, setIntensity] = useState<number>(0.5);

  const [reactionId, setReactionId] = useState(0);

  const [isThinking, setIsThinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  const talkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [serverStatus, setServerStatus] = useState(
    '서버 연결 확인 중...'
  );

  // ========================================
  // 2. 커스텀 캐릭터 상태 관리
  // ========================================

  const [customRig, setCustomRig] = useState<CharacterRig | null>(
    loadCustomRig
  );

  const [characterType, setCharacterType] = useState<CharacterType>(() => {
    try {
      const saved = localStorage.getItem(CHARACTER_STORAGE_KEY);

      if (
        saved === 'basic' ||
        saved === 'illustration' ||
        saved === 'pomeranian'
      ) {
        return saved;
      }

      if (saved === 'custom' && loadCustomRig()) {
        return 'custom';
      }

      return 'basic';
    } catch {
      return 'basic';
    }
  });

    // Electron 데스크톱 캐릭터 창에 캐릭터 정보 전달
    useEffect(() => {
      const api = window.step1;

      if (!api) return;

      // 커스텀 캐릭터는 리깅 데이터를 먼저 전달
      if (characterType === 'custom') {
        if (!customRig) return;

        api.sendCustomRig(customRig);
      }

      api.selectCharacter(characterType);
    }, [characterType, customRig]);

  const handleCharacterChange = (type: CharacterType) => {
    if (type === 'custom' && !customRig) return;

    setCharacterType(type);

    try {
      localStorage.setItem(CHARACTER_STORAGE_KEY, type);
    } catch {
      // 저장할 수 없어도 캐릭터 전환은 유지
    }
  };

  const handleCustomCharacterGenerated = (rig: CharacterRig) => {
    setCustomRig(rig);
    setCharacterType('custom');

    try {
      localStorage.setItem(
        CUSTOM_RIG_STORAGE_KEY,
        JSON.stringify(rig)
      );
      localStorage.setItem(CHARACTER_STORAGE_KEY, 'custom');
    } catch (error) {
      console.warn('커스텀 캐릭터 저장 실패:', error);
    }
  };

  const reaction: CharacterReaction = {
    emotion,
    intensity,
    action,
  };

  // ========================================
  // 3. Electron 감정 동기화
  // ========================================

  useEffect(() => {
    window.step1?.sendReaction({
      reaction: {
        emotion,
        intensity,
        action,
      },
      isThinking,
      isTalking,
      reactionId,
    });
  }, [
    emotion,
    intensity,
    action,
    isThinking,
    isTalking,
    reactionId,
  ]);

  // ========================================
  // 4. AI 응답에 따른 감정 변경
  // ========================================

  const handleAIReaction = (newReaction: CharacterReaction) => {
    setEmotion(newReaction.emotion);
    setAction(newReaction.action);
    setIntensity(newReaction.intensity);
    setReactionId((prev) => prev + 1);
  };

  // ========================================
  // 5. Talking Animation 관리
  // ========================================

  const handleTalkingStart = (text: string) => {
    if (talkingTimerRef.current !== null) {
      clearTimeout(talkingTimerRef.current);
      talkingTimerRef.current = null;
    }

    setIsTalking(true);

    const duration = Math.min(
      5000,
      Math.max(1000, text.length * 80)
    );

    talkingTimerRef.current = setTimeout(() => {
      setIsTalking(false);
      talkingTimerRef.current = null;
    }, duration);
  };

  // ========================================
  // 6. Thinking Animation 관리
  // ========================================

  const handleThinkingChange = (thinking: boolean) => {
    setIsThinking(thinking);

    if (thinking) {
      setIsTalking(false);

      if (talkingTimerRef.current !== null) {
        clearTimeout(talkingTimerRef.current);
        talkingTimerRef.current = null;
      }
    }
  };

  // ========================================
  // 7. 행동 자동 초기화
  // ========================================

  useEffect(() => {
    if (action === 'idle') return;

    const timer = setTimeout(() => {
      setAction('idle');
    }, 1000);

    return () => clearTimeout(timer);
  }, [action]);

  // ========================================
  // 8. FastAPI 서버 연결 확인
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    const checkServer = async () => {
      try {
        const response = await fetch(
          'http://127.0.0.1:8000/api/health',
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('서버 응답 오류');
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setServerStatus(data.message);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('백엔드 연결 실패:', error);
          setServerStatus('백엔드 서버 연결 실패');
        }
      }
    };

    checkServer();

    return () => controller.abort();
  }, []);

  // ========================================
  // 9. 컴포넌트 종료 시 타이머 정리
  // ========================================

  useEffect(() => {
    return () => {
      if (talkingTimerRef.current !== null) {
        clearTimeout(talkingTimerRef.current);
      }
    };
  }, []);

  // ========================================
  // 10. 캐릭터 선택 버튼 스타일
  // ========================================

  const characterButtonStyle = (type: CharacterType) => ({
    padding: '10px 16px',
    borderRadius: '12px',
    cursor: type === 'custom' && !customRig
      ? 'not-allowed'
      : 'pointer',
    border:
      characterType === type
        ? '2px solid #8b9bb4'
        : '1px solid #ddd',
    backgroundColor:
      characterType === type
        ? '#e8edf5'
        : '#ffffff',
    color: '#333333',
    opacity: type === 'custom' && !customRig ? 0.5 : 1,
  });

  // ========================================
  // 11. 화면 렌더링
  // ========================================

  return (
    <main className="app-container">
      <h1 className="app-title">GPT Companion</h1>

      <p className="app-description">
        나만의 AI 캐릭터와 대화하는 공간
      </p>

      <p className="server-status">
        {serverStatus}
      </p>

      {/* 캐릭터 선택 버튼 */}
      <div
        className="character-selector"
        role="group"
        aria-label="캐릭터 선택"
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          margin: '20px 0',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => handleCharacterChange('basic')}
          aria-pressed={characterType === 'basic'}
          style={characterButtonStyle('basic')}
        >
          ⚪ 기본 캐릭터
        </button>

        <button
          type="button"
          onClick={() => handleCharacterChange('illustration')}
          aria-pressed={characterType === 'illustration'}
          style={characterButtonStyle('illustration')}
        >
          🎨 일러스트 캐릭터
        </button>

        <button
          type="button"
          onClick={() => handleCharacterChange('pomeranian')}
          aria-pressed={characterType === 'pomeranian'}
          style={characterButtonStyle('pomeranian')}
        >
          🐶 포메라니안
        </button>

        <button
          type="button"
          onClick={() => handleCharacterChange('custom')}
          aria-pressed={characterType === 'custom'}
          disabled={!customRig}
          style={characterButtonStyle('custom')}
        >
          ✨ 내 캐릭터
        </button>
      </div>

      {/* 이미지 업로드 및 자동 리깅 */}
      <CharacterUploader
        onCharacterGenerated={handleCustomCharacterGenerated}
      />

      {/* AI 캐릭터 */}
      {characterType === 'custom' && customRig ? (
        <RiggedCharacter
          rig={customRig}
          reaction={reaction}
        />
      ) : characterType === 'pomeranian' ? (
        <PomeranianCharacter
          emotion={emotion}
          isTalking={isTalking}
        />
      ) : (
        <Character
          characterType={
            characterType === 'custom' ? 'basic' : characterType
          }
          reaction={reaction}
          isThinking={isThinking}
          isTalking={isTalking}
          reactionId={reactionId}
        />
      )}

      {/* 감정 및 행동 테스트 버튼 */}
      <ReactionControls
        emotion={emotion}
        action={action}
        intensity={intensity}
        onEmotionChange={setEmotion}
        onActionChange={setAction}
        onIntensityChange={setIntensity}
      />

      {/* AI 채팅 */}
      <Chat
        onReaction={handleAIReaction}
        onLoadingChange={handleThinkingChange}
        onTalkingStart={handleTalkingStart}
      />
    </main>
  );
}

export default App;
