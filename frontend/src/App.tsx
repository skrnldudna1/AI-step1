
import { useEffect, useRef, useState } from 'react';

import CharacterUploader from './components/CharacterUploader/CharacterUploader';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';
import RiggedCharacter from './components/Character/RiggedCharacter';
import CharacterSizeControl from './components/Character/CharacterSizeControl';

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

// ========================================
// 저장 키
// ========================================

const CHARACTER_STORAGE_KEY = 'gpt-companion-character';
const CUSTOM_RIG_STORAGE_KEY = 'gpt-companion-custom-rig';
const CHARACTER_SIZE_STORAGE_KEY = 'step1-character-size';

// ========================================
// 커스텀 캐릭터 불러오기
// ========================================

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

// ========================================
// 캐릭터 크기 불러오기
// ========================================

function loadCharacterSize(): number {
  try {
    const saved = localStorage.getItem(CHARACTER_SIZE_STORAGE_KEY);

    if (saved === null) return 100;

    const parsed = Number(saved);

    if (
      Number.isFinite(parsed) &&
      parsed >= 50 &&
      parsed <= 200
    ) {
      return parsed;
    }

    return 100;
  } catch {
    return 100;
  }
}

// ========================================
// App
// ========================================

function App() {
  // ========================================
  // 1. 캐릭터 감정 상태
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
  // 2. 커스텀 캐릭터
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

  // ========================================
  // 3. 캐릭터 크기
  // ========================================

  const [characterSize, setCharacterSize] =
    useState<number>(loadCharacterSize);

  const sizeEditedRef = useRef(false);

  // 재실행 시 Electron의 설정을 우선 복원한다.
  // 최초 실행만 기존 웹 저장값을 Electron으로 이전한다.
  useEffect(() => {
    const api = window.step1;
    if (!api) return;
    let active = true;

    api.getCharacterSize()
      .then((savedSize) => {
        if (!active || sizeEditedRef.current) return;
        if (savedSize === null) {
          api.setCharacterSize(loadCharacterSize());
        } else {
          setCharacterSize(savedSize);
        }
      })
      .catch(console.error);

    return () => { active = false; };
  }, []);

  const handleCharacterSizeChange = (size: number) => {
    if (!Number.isFinite(size) || size < 50 || size > 200) return;
    sizeEditedRef.current = true;
    setCharacterSize(size);
    window.step1?.setCharacterSize(size);
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        CHARACTER_SIZE_STORAGE_KEY,
        String(characterSize)
      );
    } catch (error) {
      console.warn('캐릭터 크기 저장 실패:', error);
    }
  }, [characterSize]);

  // ========================================
  // 4. Electron 캐릭터 선택 동기화
  // ========================================

  useEffect(() => {
    const api = window.step1;

    if (!api) return;

    if (characterType === 'custom') {
      if (!customRig) return;

      api.sendCustomRig(customRig);
    }

    api.selectCharacter(characterType);
  }, [characterType, customRig]);

  // ========================================
  // 5. 캐릭터 선택
  // ========================================

  const handleCharacterChange = (type: CharacterType) => {
    if (type === 'custom' && !customRig) return;

    setCharacterType(type);

    try {
      localStorage.setItem(
        CHARACTER_STORAGE_KEY,
        type
      );
    } catch {
      // 저장 실패 시에도 캐릭터 전환 유지
    }
  };

  // ========================================
  // 6. 커스텀 캐릭터 생성 완료
  // ========================================

  const handleCustomCharacterGenerated = (rig: CharacterRig) => {
    setCustomRig(rig);
    setCharacterType('custom');

    try {
      localStorage.setItem(
        CUSTOM_RIG_STORAGE_KEY,
        JSON.stringify(rig)
      );

      localStorage.setItem(
        CHARACTER_STORAGE_KEY,
        'custom'
      );
    } catch (error) {
      console.warn('커스텀 캐릭터 저장 실패:', error);
    }
  };

  // ========================================
  // 7. 현재 캐릭터 반응
  // ========================================

  const reaction: CharacterReaction = {
    emotion,
    intensity,
    action,
  };

  // ========================================
  // 8. Electron 감정 동기화
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
  // 9. AI 응답에 따른 감정 변경
  // ========================================

  const handleAIReaction = (newReaction: CharacterReaction) => {
    setEmotion(newReaction.emotion);
    setAction(newReaction.action);
    setIntensity(newReaction.intensity);
    setReactionId((prev) => prev + 1);
  };

  // ========================================
  // 10. Talking Animation
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
  // 11. Thinking Animation
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
  // 12. 행동 자동 초기화
  // ========================================

  useEffect(() => {
    if (action === 'idle') return;

    const timer = setTimeout(() => {
      setAction('idle');
    }, 1000);

    return () => clearTimeout(timer);
  }, [action]);

  // ========================================
  // 13. FastAPI 서버 연결 확인
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
  // 14. 타이머 정리
  // ========================================

  useEffect(() => {
    return () => {
      if (talkingTimerRef.current !== null) {
        clearTimeout(talkingTimerRef.current);
      }
    };
  }, []);

  // ========================================
  // 15. 캐릭터 버튼 스타일
  // ========================================

  const characterButtonStyle = (type: CharacterType) => ({
    padding: '10px 16px',
    borderRadius: '12px',

    cursor:
      type === 'custom' && !customRig
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

    opacity:
      type === 'custom' && !customRig
        ? 0.5
        : 1,
  });

  // ========================================
  // 16. 화면 렌더링
  // ========================================

  return (
    <main className="app-container">
      <h1 className="app-title">
        GPT Companion
      </h1>

      <p className="app-description">
        나만의 AI 캐릭터와 대화하는 공간
      </p>

      <p className="server-status">
        {serverStatus}
      </p>

      {/* =====================================
          캐릭터 선택
      ===================================== */}

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

      {/* =====================================
          캐릭터 업로드
      ===================================== */}

      <CharacterUploader
        onCharacterGenerated={handleCustomCharacterGenerated}
      />

      {/* =====================================
          캐릭터 표시
      ===================================== */}

      <div
        className="character-display"
        style={{
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        <div
          className="character-size-stage"
          style={{ zoom: characterSize / 100, margin: '0 auto' }}
        >
          {characterType === 'custom' && customRig ? (
            <div style={{
              width: Math.min(250, 330 * customRig.canvas.width / customRig.canvas.height),
            }}>
              <RiggedCharacter
                rig={customRig}
                reaction={reaction}
                isTalking={isTalking}
                isThinking={isThinking}
              />
            </div>
          ) : characterType === 'pomeranian' ? (
            <PomeranianCharacter
              emotion={emotion}
              isTalking={isTalking}
            />
          ) : (
            <Character
              characterType={
                characterType === 'custom'
                  ? 'basic'
                  : characterType
              }
              reaction={reaction}
              isThinking={isThinking}
              isTalking={isTalking}
              reactionId={reactionId}
            />
          )}
        </div>
      </div>

      {/* =====================================
          캐릭터 크기 조절
      ===================================== */}

      <CharacterSizeControl
        size={characterSize}
        onChange={handleCharacterSizeChange}
      />

      {/* =====================================
          감정 및 행동 테스트
      ===================================== */}

      <ReactionControls
        emotion={emotion}
        action={action}
        intensity={intensity}
        onEmotionChange={setEmotion}
        onActionChange={setAction}
        onIntensityChange={setIntensity}
      />

      {/* =====================================
          AI 채팅
      ===================================== */}

      <Chat
        onReaction={handleAIReaction}
        onLoadingChange={handleThinkingChange}
        onTalkingStart={handleTalkingStart}
      />
    </main>
  );
}

export default App;
