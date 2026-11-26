
import { useEffect, useRef, useState } from 'react';

import CharacterUploader from './components/CharacterUploader/CharacterUploader';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';
import RiggedCharacter from './components/Character/RiggedCharacter';
import CharacterSizeControl from './components/Character/CharacterSizeControl';
import RigHeadControl from './components/Character/RigHeadControl';
import { getRigHeadPlan } from './headRig';

import ReactionControls from './components/ReactionControls/ReactionControls';
import Chat from './components/Chat/Chat';
import AIConnectionPanel from './components/Chat/AIConnectionPanel';
import useAIConnection from './hooks/useAIConnection';
import StudioIcon from './components/StudioIcon';
import PersonaEditor from './components/PersonaEditor/PersonaEditor';
import usePersonaState from './hooks/usePersonaState';
import { PERSONALITIES } from './persona';

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

const characterOptions: { type: CharacterType; label: string; description: string }[] = [
  { type: 'basic', label: '베이직', description: '동그란 친구' },
  { type: 'illustration', label: '일러스트', description: '그림 친구' },
  { type: 'pomeranian', label: '포메라니안', description: '복슬복슬한 친구' },
  { type: 'custom', label: '내 캐릭터', description: '직접 만든 친구' },
];

function CharacterThumbnail({ type }: { type: CharacterType }) {
  if (type === 'basic') return <span className="thumbnail-basic" aria-hidden="true"><i /><i /><b /></span>;
  if (type === 'illustration') return <img src="/character/neutral.png" alt="" />;
  if (type === 'pomeranian') {
    return <span className="thumbnail-pom" aria-hidden="true">
      {['tail', 'base', 'eyes_open', 'nose', 'mouth_idle'].map(part => <img key={part} src={`/character/pomeranian/${part}.png`} alt="" />)}
    </span>;
  }
  return <StudioIcon name="sparkles" />;
}

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
  const aiConnection = useAIConnection();
  const [tab, setTab] = useState<'character' | 'profile' | 'chat'>('character');
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
  const [serverConnection, setServerConnection] = useState<'checking' | 'online' | 'offline'>('checking');
  const [aiModeLabel, setAiModeLabel] = useState('');
  const [serverRetry, setServerRetry] = useState(0);

  // ========================================
  // 2. 커스텀 캐릭터
  // ========================================

  const [customRig, setCustomRig] = useState<CharacterRig | null>(
    loadCustomRig
  );
  const [showHeadGuide, setShowHeadGuide] = useState(false);

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
  const { state: personaState, ready: personasReady, saveProfile } = usePersonaState();
  const profile = personaState.profiles[characterType];

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

  const updateHeadSplit = (value: number | undefined) => {
    if (!customRig) return;
    const next = { ...customRig, headSplit: value };
    setCustomRig(next);
    try { localStorage.setItem(CUSTOM_RIG_STORAGE_KEY, JSON.stringify(next)); }
    catch (error) { console.warn('머리 분리 설정 저장 실패:', error); }
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
    const api = window.step1;
    if (!api?.getReactionState) return;
    let active = true;
    let received = false;
    const apply = (state: NonNullable<Awaited<ReturnType<typeof api.getReactionState>>>) => {
      setEmotion(state.reaction.emotion);
      setAction(state.reaction.action);
      setIntensity(state.reaction.intensity);
      setIsThinking(state.isThinking);
      setIsTalking(state.isTalking);
      setReactionId(state.reactionId);
    };
    const unsubscribe = api.onReactionChanged((state) => {
      received = true;
      apply(state);
    });
    api.getReactionState().then((state) => {
      if (active && !received && state) apply(state);
    }).catch(console.error);
    return () => { active = false; unsubscribe(); };
  }, []);

  const updateManualReaction = (patch: Partial<CharacterReaction>) => {
    if (window.step1?.updateReaction) {
      window.step1.updateReaction(patch);
      return;
    }
    if (patch.emotion !== undefined) {
      setEmotion(patch.emotion);
      if (patch.emotion !== 'neutral' || patch.emotion !== emotion) setReactionId(prev => prev + 1);
    }
    if (patch.action !== undefined) {
      setAction(patch.action);
      if (patch.action !== 'idle') setReactionId((prev) => prev + 1);
    }
    if (patch.intensity !== undefined) setIntensity(patch.intensity);
  };

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

  const handleChatReset = () => {
    if (talkingTimerRef.current !== null) {
      clearTimeout(talkingTimerRef.current);
      talkingTimerRef.current = null;
    }
    setEmotion('neutral');
    setAction('idle');
    setIntensity(0.5);
    setIsThinking(false);
    setIsTalking(false);
    setReactionId(previous => previous + 1);
  };

  // ========================================
  // 12. 행동 자동 초기화
  // ========================================

  useEffect(() => {
    if (window.step1?.updateReaction) return;
    if (action === 'idle') return;

    const timer = setTimeout(() => {
      setAction('idle');
    }, 1000);

    return () => clearTimeout(timer);
  }, [action]);

  useEffect(() => {
    if (window.step1?.updateReaction || (emotion === 'neutral' && intensity === 0.5) || isThinking || isTalking) return;
    const timer = setTimeout(() => {
      setEmotion('neutral');
      setIntensity(0.5);
    }, 3500);
    return () => clearTimeout(timer);
  }, [emotion, intensity, reactionId, isThinking, isTalking]);

  // ========================================
  // 13. FastAPI 서버 연결 확인
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    const checkServer = async () => {
      setServerConnection('checking');
      setAiModeLabel('');
      setServerStatus('서버 연결 확인 중...');
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
          setAiModeLabel(data.ai_configured === false ? 'AI 설정 필요' : data.ai_mode === 'openai' ? '실제 AI' : data.ai_mode === 'mock' ? '테스트 모드' : '');
          setServerConnection('online');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('백엔드 연결 실패:', error);
          setServerStatus('백엔드 서버 연결 실패');
          setServerConnection('offline');
        }
      }
    };

    checkServer();

    return () => controller.abort();
  }, [serverRetry]);

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

  const currentCharacter = characterOptions.find(option => option.type === characterType) ?? characterOptions[0];
  const activity = isThinking ? '생각하는 중' : isTalking ? '대화하는 중' : '함께할 준비 완료';
  const renderCharacter = (withGuide = false) => characterType === 'custom' && customRig ? (
    <div style={{ width: Math.min(250, 330 * customRig.canvas.width / customRig.canvas.height), position: 'relative' }}>
      <RiggedCharacter rig={customRig} reaction={reaction} isTalking={isTalking} isThinking={isThinking} reactionId={reactionId} />
      {withGuide && showHeadGuide && <div className="rig-neck-guide" style={{ top: `${getRigHeadPlan(customRig).neckY}%` }} aria-hidden="true" />}
    </div>
  ) : characterType === 'pomeranian' ? (
    <PomeranianCharacter reaction={reaction} isTalking={isTalking} isThinking={isThinking} reactionId={reactionId} />
  ) : (
    <Character characterType={characterType === 'custom' ? 'basic' : characterType}
      reaction={reaction} isThinking={isThinking} isTalking={isTalking} reactionId={reactionId} />
  );

  return (
    <div className="studio-shell">
      <main className="app-container" id="studio">
        <header className="studio-heading">
          <div>
            <h1 className="app-title">Step1<span>.</span></h1>
          </div>
          <div className="studio-top-actions">
            <button type="button" className={`server-status status-${aiConnection?.mode === 'chatgpt' ? (aiConnection.connected ? 'online' : 'offline') : serverConnection}`} title={aiConnection?.mode === 'chatgpt' ? 'ChatGPT 연결 설정 열기' : serverStatus + ' · 클릭하여 다시 확인'} onClick={() => aiConnection?.mode === 'chatgpt' ? setTab('chat') : setServerRetry(n => n + 1)} aria-label={aiConnection?.mode === 'chatgpt' ? 'ChatGPT 연결 설정 열기' : serverStatus + ', 다시 확인'}>
              <span className="status-dot" />{aiConnection?.mode === 'chatgpt' ? (aiConnection.connected ? 'ChatGPT 연결됨' : 'ChatGPT 연결 필요') : serverConnection === 'online' ? (aiModeLabel || '서버 연결됨') : serverConnection === 'offline' ? '연결 끊김' : '연결 확인 중'}
              <StudioIcon name="reset" width="13" height="13" />
            </button>
            {window.step1?.openChat ? <button type="button" className="studio-primary" onClick={() => window.step1?.openChat()}><StudioIcon name="external" /> 미니 채팅</button>
              : <button className="studio-primary" onClick={() => setTab('chat')}><StudioIcon name="chat" /> 대화하기</button>}
          </div>
        </header>

        <nav className="studio-tabs" aria-label="주 메뉴" data-active={tab}>
          {([['character', '캐릭터'], ['profile', '프로필'], ['chat', '대화']] as const).map(([id, label]) =>
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
          )}
        </nav>
        <div className="studio-grid studio-panel" hidden={tab !== 'character'}>
          <section className="studio-card companion-card" id="appearance" aria-labelledby="appearance-title">
            <header className="card-heading">
              <div><h2 id="appearance-title">나의 캐릭터</h2></div>
              <span className="activity-pill"><span className="activity-dot" />{activity}</span>
            </header>
            <div className="preview-stage">
              <div className="preview-meta"><span><span className="preview-live-dot" /> LIVE PREVIEW</span><strong>{characterSize}%</strong></div>
              <div className="character-display" aria-label="캐릭터 미리보기">
                <div className="character-size-stage" style={{ zoom: characterSize / 100 }}>
                  {renderCharacter(true)}
                </div>
              </div>
              <div className="preview-caption"><strong>{profile.name}</strong><span>{currentCharacter.label} · {PERSONALITIES[profile.personality].label}</span></div>
            </div>
            <div className="character-selector" role="group" aria-label="캐릭터 선택">
              {characterOptions.map(option => (
                <button key={option.type} type="button" className="character-choice" aria-pressed={characterType === option.type}
                  aria-label={option.type === 'custom' ? option.label : option.label + ' 캐릭터'} title={personaState.profiles[option.type].name + ' · ' + option.description}
                  disabled={option.type === 'custom' && !customRig} onClick={() => handleCharacterChange(option.type)}>
                  <span className="character-thumbnail"><CharacterThumbnail type={option.type} /></span>
                  <span className="choice-name">{personaState.profiles[option.type].name}</span>
                  <small className="choice-type">{option.label}</small>
                </button>
              ))}
            </div>
            <CharacterSizeControl size={characterSize} onChange={handleCharacterSizeChange} />
            {characterType === 'custom' && customRig && <RigHeadControl rig={customRig} onChange={updateHeadSplit} onGuide={setShowHeadGuide} />}
          </section>

          <section className="studio-card expression-card" id="expressions" aria-label="감정 및 행동 설정">
            <ReactionControls emotion={emotion} action={action} intensity={intensity}
              preview={<div className="character-size-stage" style={{ zoom: .47 }}>{renderCharacter()}</div>}
              previewName={profile.name}
              isThinking={isThinking}
              onEmotionChange={(emotion) => updateManualReaction({ emotion })}
              onActionChange={(action) => updateManualReaction({ action })}
              onIntensityChange={(intensity) => updateManualReaction({ intensity })} />
              <p className="reset-hint">표정은 대화가 끝난 뒤 3.5초 후 기본 표정으로 돌아와요.</p>
          </section>
          <details className="studio-card workshop-card" id="workshop">
            <summary><StudioIcon name="sparkles" /> 내 캐릭터 만들기</summary>
            <CharacterUploader onCharacterGenerated={handleCustomCharacterGenerated} />
          </details>
        </div>
        <div className="studio-panel" hidden={tab !== 'chat'}>
          <section className="studio-card conversation-card" id="conversation" aria-labelledby="conversation-title">
            <header className="card-heading">
              <div><h2 id="conversation-title">우리의 대화</h2></div>
              <span className="conversation-icon"><StudioIcon name="chat" /></span>
            </header>
            <p className="card-description">{profile.name}에게 편하게 이야기해 보세요.</p>
            <AIConnectionPanel busy={isThinking} visible={tab === 'chat'} backendLabel={aiModeLabel} />
            <Chat profile={profile} onReaction={handleAIReaction} onLoadingChange={handleThinkingChange} onTalkingStart={handleTalkingStart} onReset={handleChatReset} />
            <div className="conversation-note"><StudioIcon name="link" width="14" height="14" />{window.step1 ? '미니 채팅창과 대화 기록을 공유해요.' : '캐릭터가 대화에 따라 반응해요.'}</div>
          </section>
        </div>
        <div className="studio-panel" hidden={tab !== 'profile'}>
          <section className="studio-card persona-card" id="persona" aria-labelledby="persona-title">
            {personasReady ? <PersonaEditor
              key={JSON.stringify([characterType, profile])}
              type={characterType} characterLabel={currentCharacter.label} profile={profile}
              onSave={next => saveProfile(characterType, next)} />
              : <p className="card-description" role="status">캐릭터 프로필 불러오는 중…</p>}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
