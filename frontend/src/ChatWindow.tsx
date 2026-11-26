import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import Chat from './components/Chat/Chat';
import StudioIcon from './components/StudioIcon';
import usePersonaState from './hooks/usePersonaState';
import type { ChatResizeEdge } from './types/chat';
import './ChatWindow.css';

const resizeEdges: ChatResizeEdge[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export default function ChatWindow() {
  const { state: personaState } = usePersonaState();
  const profile = personaState.profiles[personaState.characterType];
  const [followsCharacter, setFollowsCharacter] = useState(true);
  const [opacity, setOpacity] = useState(100);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<ChatResizeEdge | null>(null);
  const resizeSequence = useRef(0);
  const resizeRef = useRef<{ pointerId: number; id: number; startX: number; startY: number } | null>(null);
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

  useEffect(() => {
    const api = window.step1;
    if (!api?.getChatOpacity) return;
    let active = true;
    let received = false;
    const unsubscribe = api.onChatOpacityChanged(next => {
      received = true;
      setOpacity(next);
    });
    api.getChatOpacity().then(next => {
      if (active && !received && next !== null) setOpacity(next);
    }).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, []);

  const changeOpacity = (next: number) => {
    setOpacity(next);
    window.step1?.setChatOpacity?.(next);
  };

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag.pointerId === -1) return;
    drag.pointerId = -1;
    setDragging(false);
    if (drag.moved) window.step1?.finishChatMove?.();
  }, []);

  const finishResize = useCallback(() => {
    const drag = resizeRef.current;
    if (!drag) return;
    resizeRef.current = null;
    setResizing(null);
    window.step1?.finishChatResize?.(drag.id);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
        if (resizeRef.current) {
          finishResize();
          return;
        }
        finishDrag();
        window.step1?.hideChat();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('blur', finishDrag);
    window.addEventListener('blur', finishResize);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('blur', finishDrag);
      window.removeEventListener('blur', finishResize);
    };
  }, [finishDrag, finishResize]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || !window.step1?.moveChatWindow || resizeRef.current) return;
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

  const startResize = (edge: ChatResizeEdge, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || resizeRef.current || !window.step1?.startChatResize) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrag();
    const id = ++resizeSequence.current;
    resizeRef.current = { pointerId: event.pointerId, id, startX: event.screenX, startY: event.screenY };
    setResizing(edge);
    event.currentTarget.setPointerCapture(event.pointerId);
    window.step1.startChatResize(edge, id);
  };

  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    window.step1?.resizeChatWindow?.({ id: drag.id, dx: event.screenX - drag.startX, dy: event.screenY - drag.startY });
  };

  const endResize = (event: PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) finishResize();
  };

  const resizeByKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 50 : 15;
    const delta: Record<string, { dx: number; dy: number }> = {
      ArrowLeft: { dx: -step, dy: 0 }, ArrowRight: { dx: step, dy: 0 },
      ArrowUp: { dx: 0, dy: -step }, ArrowDown: { dx: 0, dy: step },
    };
    const api = window.step1;
    if (!delta[event.key] || !api?.startChatResize || resizeRef.current) return;
    event.preventDefault();
    const id = ++resizeSequence.current;
    api.startChatResize('se', id);
    api.resizeChatWindow({ id, ...delta[event.key] });
    api.finishChatResize(id);
  };

  return (
    <main className="mini-chat-window" data-follow={followsCharacter} data-resizing={resizing ?? undefined} style={{ '--mini-chat-alpha': opacity / 100 } as CSSProperties}>
      <Chat profile={profile} compact renderHeader={({ clearDisabled, onClear }) => <header className="mini-chat-header">
        <div
          className={`mini-chat-drag-handle${dragging ? ' is-dragging' : ''}`}
          title="드래그하여 채팅창을 따로 이동"
          aria-label="채팅창 이동 손잡이"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
        />
        <label className="mini-opacity-inline" title={`창 투명도 ${100 - opacity}%`}>
          <StudioIcon name="opacity" width="13" height="13" />
          <input id="chat-transparency" aria-label="창 투명도" aria-valuetext={`${100 - opacity}% 투명`} type="range" min="0" max="60" step="5"
            value={100 - opacity} onChange={event => changeOpacity(100 - Number(event.target.value))} />
        </label>
        <div className="mini-chat-actions">
          <button
            type="button"
            className="mini-chat-follow"
            title={followsCharacter ? '캐릭터에서 분리' : '캐릭터에 다시 붙이기'}
            aria-label={followsCharacter ? '캐릭터에서 분리' : '캐릭터에 다시 붙이기'}
            aria-pressed={followsCharacter}
            onClick={() => window.step1?.setChatFollow?.(!followsCharacter)}
          >
            <StudioIcon name={followsCharacter ? 'pin' : 'link'} width="14" height="14" />
          </button>
          <button type="button" title="대화 기록 삭제" aria-label="대화 기록 삭제" className="mini-chat-clear"
            disabled={clearDisabled} onClick={onClear}>
            <StudioIcon name="trash" width="14" height="14" />
          </button>
          <button type="button" title="채팅 닫기 (Esc)" aria-label="채팅 닫기" onClick={() => window.step1?.hideChat()}>
            <StudioIcon name="close" width="14" height="14" />
          </button>
        </div>
      </header>} />
      {window.step1?.startChatResize && resizeEdges.map(edge => (
        <div key={edge} className={`mini-resize-handle mini-resize-${edge}`}
          aria-hidden={edge === 'se' ? undefined : true} role={edge === 'se' ? 'button' : undefined}
          aria-label={edge === 'se' ? '미니 채팅창 크기 조절 (방향키)' : undefined}
          title={edge === 'se' ? '드래그하여 채팅창 크기 조절' : undefined}
          tabIndex={edge === 'se' ? 0 : undefined}
          onKeyDown={edge === 'se' ? resizeByKey : undefined}
          onPointerDown={event => startResize(edge, event)}
          onPointerMove={moveResize}
          onPointerUp={event => { moveResize(event); endResize(event); }}
          onPointerCancel={endResize}
          onLostPointerCapture={endResize}
        />
      ))}
    </main>
  );
}
