import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import Chat from './components/Chat/Chat';
import StudioIcon from './components/StudioIcon';
import usePersonaState from './hooks/usePersonaState';
import './ChatWindow.css';

export default function ChatWindow() {
  const { state: personaState } = usePersonaState();
  const profile = personaState.profiles[personaState.characterType];
  const [followsCharacter, setFollowsCharacter] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({
    pointerId: -1, moved: false, startX: 0, startY: 0, lastX: 0, lastY: 0,
  });

  useEffect(() => {
    const api = window.step1;
    if (!api?.getChatFollow) return;
    let active = true;
    let received = false;
    const unsubscribe = api.onChatFollowChanged((follow) => {
      received = true;
      setFollowsCharacter(follow);
    });
    api.getChatFollow().then((follow) => {
      if (active && !received && follow !== null) setFollowsCharacter(follow);
    }).catch(console.error);
    return () => { active = false; unsubscribe(); };
  }, []);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag.pointerId === -1) return;
    drag.pointerId = -1;
    setDragging(false);
    if (drag.moved) window.step1?.finishChatMove?.();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finishDrag();
        window.step1?.hideChat();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('blur', finishDrag);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('blur', finishDrag);
    };
  }, [finishDrag]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || !window.step1?.moveChatWindow) return;
    dragRef.current = {
      pointerId: event.pointerId, moved: false,
      startX: event.screenX, startY: event.screenY,
      lastX: event.screenX, lastY: event.screenY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.screenX - drag.startX, event.screenY - drag.startY) < 4) return;
    const dx = event.screenX - drag.lastX;
    const dy = event.screenY - drag.lastY;
    if (!dx && !dy) return;
    drag.moved = true;
    setDragging(true);
    window.step1?.moveChatWindow({ dx, dy });
    drag.lastX = event.screenX;
    drag.lastY = event.screenY;
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId === dragRef.current.pointerId) finishDrag();
  };

  return (
    <main className="mini-chat-window" data-follow={followsCharacter}>
      <header className="mini-chat-header">
        <div
          className={`mini-chat-brand mini-chat-drag-handle${dragging ? ' is-dragging' : ''}`}
          title="드래그하여 채팅창을 따로 이동"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
        >
          <span className="mini-chat-avatar" aria-hidden="true"><StudioIcon name="paw" width="21" height="21" /></span>
          <div>
            <h1 title={profile.name}>{profile.name}<span>.</span></h1>
            <p><span className="mini-chat-indicator" /> {followsCharacter ? '함께 이동' : '자유 이동'}</p>
          </div>
        </div>
        <div className="mini-chat-actions">
          <button
            type="button"
            className="mini-chat-follow"
            title={followsCharacter ? '캐릭터에서 분리' : '캐릭터에 다시 붙이기'}
            aria-label={followsCharacter ? '캐릭터에서 분리' : '캐릭터에 다시 붙이기'}
            aria-pressed={followsCharacter}
            onClick={() => window.step1?.setChatFollow?.(!followsCharacter)}
          >
            <StudioIcon name={followsCharacter ? 'pin' : 'link'} width="15" height="15" />
          </button>
          <button type="button" title="설정 열기" aria-label="설정 열기" onClick={() => window.step1?.openSettings()}>
            <StudioIcon name="settings" width="15" height="15" />
          </button>
          <button type="button" title="채팅 닫기 (Esc)" aria-label="채팅 닫기" onClick={() => window.step1?.hideChat()}>
            <StudioIcon name="close" width="15" height="15" />
          </button>
        </div>
      </header>
      <Chat profile={profile} />
    </main>
  );
}
