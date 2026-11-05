import { useEffect, useState } from 'react';

import Character from './components/Character/Character';
import ReactionControls from './components/ReactionControls/ReactionControls';
import Chat from './components/Chat/Chat';

import type { Emotion } from './types/emotion';
import type { Action } from './types/action';
import type { CharacterReaction } from './types/character';

import './App.css';

function App() {
  // 캐릭터 상태
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [action, setAction] = useState<Action>('idle');
  const [intensity, setIntensity] = useState<number>(0.5);
  const [reactionId, setReactionId] = useState(0);

  // 백엔드 연결 상태
  const [serverStatus, setServerStatus] = useState('서버 연결 확인 중...');

  const reaction: CharacterReaction = {
    emotion,
    intensity,
    action,
  };

    // AI 응답에 따라 캐릭터 상태 변경
    const handleAIReaction = (newReaction: CharacterReaction) => {
      setEmotion(newReaction.emotion);
      setAction(newReaction.action);
      setIntensity(newReaction.intensity);
    
      setReactionId((prev) => prev + 1);
    };

  // 캐릭터 행동을 1초 후 초기화
  useEffect(() => {
    if (action === 'idle') return;

    const timer = setTimeout(() => {
      setAction('idle');
    }, 1000);

    return () => clearTimeout(timer);
  }, [action]);

  // FastAPI 서버 연결 확인
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

      <Character key={reactionId} reaction={reaction} />

      <ReactionControls
        emotion={emotion}
        action={action}
        intensity={intensity}
        onEmotionChange={setEmotion}
        onActionChange={setAction}
        onIntensityChange={setIntensity}
      />

      <Chat onReaction={handleAIReaction} />
    </main>
  );
}

export default App;