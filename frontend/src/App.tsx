
import { useEffect, useRef, useState } from 'react';

import CharacterUploader from './components/CharacterUploader/CharacterUploader';

import Character from './components/Character/Character';
import PomeranianCharacter from './components/Character/PomeranianCharacter';
import RiggedCharacter from './components/Character/RiggedCharacter';
import CharacterSizeControl from './components/Character/CharacterSizeControl';

import ReactionControls from './components/ReactionControls/ReactionControls';
import Chat from './components/Chat/Chat';
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
  const [serverRetry, setServerRetry] = useState(0);

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
      if (patch.emotion !== emotion) setReactionId(prev => prev + 1);
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

  // ========================================
  // 13. FastAPI 서버 연결 확인
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    const checkServer = async () => {
      setServerConnection('checking');
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
  const renderCharacter = () => characterType === 'custom' && customRig ? (
    <div style={{ width: Math.min(250, 330 * customRig.canvas.width / customRig.canvas.height) }}>
      <RiggedCharacter rig={customRig} reaction={reaction} isTalking={isTalking} isThinking={isThinking} reactionId={reactionId} />
    </div>
  ) : characterType === 'pomeranian' ? (
    <PomeranianCharacter reaction={reaction} isTalking={isTalking} isThinking={isThinking} reactionId={reactionId} />
  ) : (
    <Character characterType={characterType === 'custom' ? 'basic' : characterType}
      reaction={reaction} isThinking={isThinking} isTalking={isTalking} reactionId={reactionId} />
  );

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar" aria-label="스튜디오 메뉴">
        <a className="studio-brand" href="#studio" aria-label="Step1 스튜디오">
          <span className="studio-logo"><StudioIcon name="paw" width="24" height="24" /></span>
          <span className="studio-brand-text"><strong>Step1<span>.</span></strong><small>COMPANION STUDIO</small></span>
        </a>
        <div className="studio-nav-label">WORKSPACE</div>
        <nav className="studio-nav">
          <a href="#studio" aria-label="스튜디오" title="스튜디오"><StudioIcon name="home" /><span>스튜디오</span></a>
          <a href="#appearance" aria-label="캐릭터 설정" title="캐릭터 설정"><StudioIcon name="palette" /><span>캐릭터 설정</span></a>
          <a href="#persona" aria-label="캐릭터 프로필" title="캐릭터 프로필"><StudioIcon name="paw" /><span>캐릭터 프로필</span></a>
          <a href="#expressions" aria-label="감정 테스트" title="감정 테스트"><StudioIcon name="smile" /><span>감정 테스트</span></a>
          <a href="#workshop" aria-label="커스텀 제작" title="커스텀 제작"><StudioIcon name="sparkles" /><span>커스텀 제작</span></a>
          <a href="#conversation" aria-label="대화" title="대화"><StudioIcon name="chat" /><span>대화</span></a>
        </nav>
        <div className="studio-sidebar-bottom">
          <div className="sidebar-companion"><StudioIcon name="paw" /><span>작은 친구와 만드는<br /><strong>특별한 하루.</strong></span></div>
          <span className="studio-version">GPT Companion · Step1</span>
        </div>
      </aside>
      <main className="app-container" id="studio">
        <header className="studio-heading">
          <div>
            <p className="studio-eyebrow">YOUR DESKTOP COMPANION</p>
            <h1 className="app-title">오늘도, 함께해요<span>.</span></h1>
            <p className="app-description">나만의 반려 캐릭터를 꾸미고 대화하는 공간</p>
          </div>
          <div className="studio-top-actions">
            <button type="button" className={`server-status status-${serverConnection}`} title={serverStatus + ' · 클릭하여 다시 확인'} onClick={() => setServerRetry(n => n + 1)} aria-label={serverStatus + ', 다시 확인'}>
              <span className="status-dot" />{serverConnection === 'online' ? '서버 연결됨' : serverConnection === 'offline' ? '연결 끊김' : '연결 확인 중'}
              <StudioIcon name="reset" width="13" height="13" />
            </button>
            {window.step1?.openChat ? <button type="button" className="studio-primary" onClick={() => window.step1?.openChat()}><StudioIcon name="external" /> 미니 채팅</button>
              : <a className="studio-primary" href="#conversation"><StudioIcon name="chat" /> 대화하기</a>}
          </div>
        </header>

        <div className="studio-grid">
          <section className="studio-card companion-card" id="appearance" aria-labelledby="appearance-title">
            <header className="card-heading">
              <div><p className="section-kicker">01 / COMPANION</p><h2 id="appearance-title">나의 캐릭터</h2></div>
              <span className="activity-pill"><span className="activity-dot" />{activity}</span>
            </header>
            <div className="preview-stage">
              <div className="preview-meta"><span><span className="preview-live-dot" /> LIVE PREVIEW</span><strong>{characterSize}%</strong></div>
              <div className="character-display" aria-label="캐릭터 미리보기">
                <div className="character-size-stage" style={{ zoom: characterSize / 100 }}>
                  {renderCharacter()}
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
          </section>

          <section className="studio-card conversation-card" id="conversation" aria-labelledby="conversation-title">
            <header className="card-heading">
              <div><p className="section-kicker">02 / CHAT</p><h2 id="conversation-title">우리의 대화</h2></div>
              <span className="conversation-icon"><StudioIcon name="chat" /></span>
            </header>
            <p className="card-description">{profile.name}에게 편하게 이야기해 보세요.</p>
            <Chat profile={profile} onReaction={handleAIReaction} onLoadingChange={handleThinkingChange} onTalkingStart={handleTalkingStart} />
            <div className="conversation-note"><StudioIcon name="link" width="14" height="14" />{window.step1 ? '미니 채팅창과 대화 기록을 공유해요.' : '캐릭터가 대화에 따라 반응해요.'}</div>
          </section>

          <section className="studio-card persona-card" id="persona" aria-labelledby="persona-title">
            {personasReady ? <PersonaEditor
              key={JSON.stringify([characterType, profile])}
              type={characterType} characterLabel={currentCharacter.label} profile={profile}
              onSave={next => saveProfile(characterType, next)} />
              : <p className="card-description" role="status">캐릭터 프로필 불러오는 중…</p>}
          </section>
          <section className="studio-card expression-card" id="expressions" aria-label="감정 및 행동 설정">
            <p className="section-kicker">04 / EXPRESSION</p>
            <ReactionControls emotion={emotion} action={action} intensity={intensity}
              preview={<div className="character-size-stage" style={{ zoom: .47 }}>{renderCharacter()}</div>}
              previewName={profile.name}
              isThinking={isThinking}
              onEmotionChange={(emotion) => updateManualReaction({ emotion })}
              onActionChange={(action) => updateManualReaction({ action })}
              onIntensityChange={(intensity) => updateManualReaction({ intensity })} />
          </section>
          <section className="studio-card workshop-card" id="workshop" aria-label="커스텀 캐릭터 제작">
            <p className="section-kicker">05 / WORKSHOP</p>
            <CharacterUploader onCharacterGenerated={handleCustomCharacterGenerated} />
          </section>
        </div>
        <footer className="studio-footer"><StudioIcon name="paw" width="14" height="14" /> Made for little moments, by Step1.</footer>
      </main>
    </div>
  );
}

export default App;
