import { useEffect, useRef, useState } from 'react';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';
import ReactionControls from './components/ReactionControls/ReactionControls';
import Chat from './components/Chat/Chat';

import type { Emotion } from './types/emotion';
import type { Action } from './types/action';
import type {
  CharacterReaction,
  CharacterType,
} from './types/character';

import './App.css';

function App() {
  // ========================================
  // 1. 캐릭터 상태 관리
  // ========================================

  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [action, setAction] = useState<Action>('idle');
  const [intensity, setIntensity] = useState<number>(0.5);

  // 같은 애니메이션을 다시 실행하기 위한 ID
  const [reactionId, setReactionId] = useState(0);

  // AI가 생각하는 중인지
  const [isThinking, setIsThinking] = useState(false);

  // AI가 말하는 중인지
  const [isTalking, setIsTalking] = useState(false);

  // 말하기 종료 타이머
  const talkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // 백엔드 서버 연결 상태
  const [serverStatus, setServerStatus] = useState(
    '서버 연결 확인 중...'
  );

  // ========================================
  // 2. 캐릭터 선택 상태 관리
  // ========================================

  // 마지막으로 선택한 캐릭터 불러오기
  const [characterType, setCharacterType] = useState<CharacterType>(() => {
    try {
      const saved = localStorage.getItem('gpt-companion-character');

      if (
        saved === 'basic' ||
        saved === 'illustration' ||
        saved === 'pomeranian'
      ) {
        return saved;
      }

      return 'basic';
    } catch {
      return 'basic';
    }
  });

  // 캐릭터 변경 및 선택값 저장
  const handleCharacterChange = (type: CharacterType) => {
    setCharacterType(type);

    try {
      localStorage.setItem('gpt-companion-character', type);
    } catch {
      // 저장이 불가능해도 캐릭터 전환은 정상 작동
    }
  };

  // 캐릭터에게 전달할 감정 데이터
  const reaction: CharacterReaction = {
    emotion,
    intensity,
    action,
  };

  // ========================================
  // 3. AI 응답에 따른 감정 변경
  // ========================================

  const handleAIReaction = (newReaction: CharacterReaction) => {
    setEmotion(newReaction.emotion);
    setAction(newReaction.action);
    setIntensity(newReaction.intensity);

    // 동일한 행동도 다시 실행할 수 있도록 ID 증가
    setReactionId((prev) => prev + 1);
  };

  // ========================================
  // 4. Talking Animation 관리
  // ========================================

  const handleTalkingStart = (text: string) => {
    // 기존 말하기 종료 타이머 제거
    if (talkingTimerRef.current !== null) {
      clearTimeout(talkingTimerRef.current);
      talkingTimerRef.current = null;
    }

    // 말하기 시작
    setIsTalking(true);

    // 답변 길이에 따라 말하기 시간 계산
    // 최소 1초, 최대 5초
    const duration = Math.min(
      5000,
      Math.max(1000, text.length * 80)
    );

    // 시간이 지나면 말하기 종료
    talkingTimerRef.current = setTimeout(() => {
      setIsTalking(false);
      talkingTimerRef.current = null;
    }, duration);
  };

  // ========================================
  // 5. Thinking Animation 관리
  // ========================================

  const handleThinkingChange = (thinking: boolean) => {
    setIsThinking(thinking);

    // 새로운 메시지를 보내면 기존 Talking 종료
    if (thinking) {
      setIsTalking(false);

      // 이전 말하기 타이머 제거
      if (talkingTimerRef.current !== null) {
        clearTimeout(talkingTimerRef.current);
        talkingTimerRef.current = null;
      }
    }
  };

  // ========================================
  // 6. 캐릭터 행동 자동 초기화
  // ========================================

  useEffect(() => {
    if (action === 'idle') return;

    // 행동 애니메이션 실행 후 기본 상태로 복귀
    const timer = setTimeout(() => {
      setAction('idle');
    }, 1000);

    return () => clearTimeout(timer);
  }, [action]);

  // ========================================
  // 7. FastAPI 서버 연결 확인
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
  // 8. 컴포넌트 종료 시 타이머 정리
  // ========================================

  useEffect(() => {
    return () => {
      if (talkingTimerRef.current !== null) {
        clearTimeout(talkingTimerRef.current);
      }
    };
  }, []);

  // ========================================
  // 9. 캐릭터 선택 버튼 스타일
  // ========================================

  const characterButtonStyle = (type: CharacterType) => ({
    padding: '10px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    border:
      characterType === type
        ? '2px solid #8b9bb4'
        : '1px solid #ddd',
    backgroundColor:
      characterType === type
        ? '#e8edf5'
        : '#ffffff',
    color: '#333333',
  });

  // ========================================
  // 10. 화면 렌더링
  // ========================================

  return (
    <main className="app-container">
      <h1 className="app-title">GPT Companion</h1>

      <p className="app-description">
        나만의 AI 캐릭터와 대화하는 공간
      </p>

      {/* 백엔드 연결 상태 */}
      <p className="server-status">
        {serverStatus}
      </p>

      {/* ========================================
          캐릭터 선택 버튼
      ======================================== */}

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
        {/* 기본 캐릭터 */}
        <button
          type="button"
          onClick={() => handleCharacterChange('basic')}
          aria-pressed={characterType === 'basic'}
          style={characterButtonStyle('basic')}
        >
          ⚪ 기본 캐릭터
        </button>

        {/* 일러스트 캐릭터 */}
        <button
          type="button"
          onClick={() => handleCharacterChange('illustration')}
          aria-pressed={characterType === 'illustration'}
          style={characterButtonStyle('illustration')}
        >
          🎨 일러스트 캐릭터
        </button>

        {/* 포메라니안 */}
        <button
          type="button"
          onClick={() => handleCharacterChange('pomeranian')}
          aria-pressed={characterType === 'pomeranian'}
          style={characterButtonStyle('pomeranian')}
        >
          🐶 포메라니안
        </button>
      </div>

      {/* ========================================
          AI 캐릭터
      ======================================== */}

      {characterType === 'pomeranian' ? (
            <PomeranianCharacter
            emotion={emotion}
            isTalking={isTalking}
          />
          ) : (
        <Character
          characterType={characterType}
          reaction={reaction}
          isThinking={isThinking}
          isTalking={isTalking}
          reactionId={reactionId}
        />
      )}

      {/* ========================================
          감정 및 행동 테스트 버튼
      ======================================== */}

      <ReactionControls
        emotion={emotion}
        action={action}
        intensity={intensity}
        onEmotionChange={setEmotion}
        onActionChange={setAction}
        onIntensityChange={setIntensity}
      />

      {/* ========================================
          AI 채팅
      ======================================== */}

      <Chat
        onReaction={handleAIReaction}
        onLoadingChange={handleThinkingChange}
        onTalkingStart={handleTalkingStart}
      />
    </main>
  );
}

export default App;