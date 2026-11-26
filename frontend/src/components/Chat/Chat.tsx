import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { ChatMessage } from "../../types/chat";
import type { CharacterReaction } from "../../types/character";

import { sendChatMessage } from "../../api/chatApi";
import StudioIcon from "../StudioIcon";
import { DEFAULT_PROFILES, getGreeting } from '../../persona';
import type { CharacterProfile } from '../../persona';
import useAIConnection from '../../hooks/useAIConnection';

import "./Chat.css";

// 부모 컴포넌트(App.tsx)에서 전달받는 함수
interface ChatProps {
  profile?: CharacterProfile;
  onReaction?: (reaction: CharacterReaction) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onTalkingStart?: (text: string) => void;
  onReset?: () => void;
  compact?: boolean;
  renderHeader?: (controls: { clearDisabled: boolean; onClear: () => void }) => ReactNode;
}

function Chat({
    profile = DEFAULT_PROFILES.basic,
    onReaction,
    onLoadingChange,
    onTalkingStart,
    onReset,
    compact = false,
    renderHeader,
  }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: getGreeting(profile),
      senderName: profile.name,
    },
  ]);

  const [input, setInput] = useState("");
  const aiConnection = useAIConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSenderName, setPendingSenderName] = useState<string | null>(null);
  const shared = Boolean(window.step1?.submitChatMessage);
  const [isReady, setIsReady] = useState(!shared);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const aiBlocked = shared && (aiConnection?.pending || (aiConnection?.mode === 'chatgpt' && (!aiConnection.connected || !aiConnection.model)));
  const [syncError, setSyncError] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState('');
  const submitRef = useRef(false);
  const historyRef = useRef(new Map<string, Pick<ChatMessage, 'role' | 'content'>[]>());
  const situationRef = useRef(new Map<string, string>());

  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const clearDialogRef = useRef<HTMLDialogElement>(null);
  const clearDisabled = messages.length <= 1 || !isReady || isLoading || isSubmitting || isClearing;

  const openClearDialog = () => {
    if (clearDisabled) return;
    setClearError('');
    clearDialogRef.current?.showModal();
  };

  const clearHistory = async () => {
    if (isLoading || isSubmitting || isClearing || submitRef.current) return;
    setIsClearing(true);
    setClearError('');
    try {
      if (shared && window.step1) {
        if (!await window.step1.clearChat()) {
          setClearError('답변이 완료된 뒤 다시 시도해 주세요.');
          return;
        }
      } else {
        historyRef.current.clear();
        situationRef.current.clear();
        setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: getGreeting(profile), senderName: profile.name }]);
        onReset?.();
      }
      clearDialogRef.current?.close();
      setSyncError(false);
    } catch {
      setClearError('대화 기록을 삭제하지 못했어요. 다시 시도해 주세요.');
    } finally { setIsClearing(false); }
  };

  useEffect(() => {
    const api = window.step1;
    if (!api?.getChatState) return;
    let active = true;
    let received = false;
    const apply = (state: NonNullable<Awaited<ReturnType<typeof api.getChatState>>>) => {
      setMessages(state.messages);
      setIsLoading(state.isLoading);
      setPendingSenderName(state.pendingSenderName ?? null);
      setIsReady(true);
      setSyncError(false);
    };
    const unsubscribe = api.onChatStateChanged((state) => {
      received = true;
      apply(state);
    });
    api.getChatState().then((state) => {
      if (!active || received) return;
      if (state) apply(state);
      else setSyncError(true);
    }).catch(() => { if (active && !received) setSyncError(true); });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (shared) return;
    setMessages(previous => previous.length === 1
      ? [{ ...previous[0], content: getGreeting(profile), senderName: profile.name }]
      : previous);
  }, [profile, shared]);

  // 새로운 메시지가 추가되면 아래로 스크롤
  useEffect(() => {
    const container = messagesScrollRef.current;
    if (container) container.scrollTo({
      top: container.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? "auto" : "smooth",
    });
  }, [messages, isLoading]);

  // 메시지 전송
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = input.trim();

    if (!trimmedMessage || trimmedMessage.length > 4000 || isLoading || !isReady || aiBlocked || isClearing || submitRef.current) {
      return;
    }

    // Electron owns the request and conversation, so closing either window
    // cannot lose an in-flight response or create a duplicate request.
    if (shared && window.step1) {
      submitRef.current = true;
      setIsSubmitting(true);
      try {
        const accepted = await window.step1.submitChatMessage(trimmedMessage);
        if (accepted) {
          setInput("");
          setSyncError(false);
        }
      } catch (error) {
        console.error("채팅 동기화 오류:", error);
        setSyncError(true);
      } finally {
        submitRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    submitRef.current = true;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setPendingSenderName(profile.name);
    onLoadingChange?.(true);

    try {
      // FastAPI 서버에 메시지 전송
      const profileKey = JSON.stringify(profile);
      const history = historyRef.current.get(profileKey) ?? [];
      const response = await sendChatMessage(trimmedMessage, profile, history, situationRef.current.get(profileKey));
      if (response.situation) situationRef.current.set(profileKey, response.situation);
      historyRef.current.set(profileKey, [...history,
        { role: 'user' as const, content: trimmedMessage },
        { role: 'assistant' as const, content: response.reply.slice(0, 4000) },
      ].slice(-12));

      // Thinking Animation 테스트용 (2초 대기)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // AI 감정 데이터를 App.tsx로 전달
onReaction?.(response.reaction);

// AI 답변을 채팅창에 추가
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.reply,
        senderName: profile.name,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // AI가 말하기 시작했다고 App.tsx에 알림
      onTalkingStart?.(response.reply);


    } catch (error) {
      console.error("채팅 API 오류:", error);

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "서버 연결에 문제가 발생했어. 잠시 후 다시 시도해 줘.",
        senderName: profile.name,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      submitRef.current = false;
      setIsLoading(false);
      setPendingSenderName(null);
      onLoadingChange?.(false);
    }
  };

  return (
    <div className={`chat-container${compact ? ' compact-chat-container' : ''}`}>
      {compact && renderHeader ? renderHeader({ clearDisabled, onClear: openClearDialog }) : <div className="chat-history-toolbar">
        <span>대화 기록</span>
        <button type="button" className="chat-clear-button" title="대화 기록 삭제" disabled={clearDisabled}
          onClick={openClearDialog}><StudioIcon name="trash" width="14" height="14" /> 기록 삭제</button>
      </div>}
      <div className="chat-messages" ref={messagesScrollRef} role="log" aria-label="대화 기록" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`chat-row ${message.role}`}>
            {!compact && message.role === 'assistant' && <span className="chat-avatar" aria-hidden="true"><StudioIcon name="paw" /></span>}
            <div className="chat-bubble-group">
              {!compact && <span className="chat-sender">{message.role === 'assistant' ? message.senderName ?? profile.name : '나'}</span>}
              <div className={`chat-message ${message.role}`}>{compact && <span className="chat-sr-only">{message.role === 'assistant' ? '캐릭터: ' : '나: '}</span>}{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-row assistant">
            {!compact && <span className="chat-avatar" aria-hidden="true"><StudioIcon name="paw" /></span>}
            <div className="chat-bubble-group">
              {!compact && <span className="chat-sender">{pendingSenderName ?? profile.name}</span>}
              <div className="chat-message assistant chat-thinking" role="status" aria-label="답변을 생각하는 중"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>{!compact && ' 답변을 생각하고 있어...'}</div>
            </div>
          </div>
        )}

        {syncError && <div className="chat-message assistant" role="alert">채팅 동기화에 문제가 발생했어. 창을 다시 열어 줘.</div>}

      </div>

      {aiConnection?.mode === 'chatgpt' && <div className="chat-plan-status">
        <span>{aiConnection.connected ? (compact ? 'ChatGPT 플랜 사용 중' : 'Using ChatGPT plan · 구독 사용량') : 'ChatGPT 계정 연결 필요'}</span>
        <button type="button" onClick={() => window.step1?.openChatGPTUsage()}>{compact ? '사용량 ↗' : '사용량 관리 ↗'}</button>
      </div>}
      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={compact ? '메시지 입력…' : '메시지를 입력해 줘...'}
          aria-label="메시지"
          maxLength={4000}
          disabled={!isReady || isLoading || isSubmitting || isClearing || !!aiBlocked}
        />

        <button type="submit" aria-label="전송" disabled={!isReady || isLoading || isSubmitting || isClearing || !!aiBlocked || !input.trim()}>
          <StudioIcon name="arrow" width="15" height="15" /> {!compact && <span>전송</span>}
        </button>
      </form>
      <dialog ref={clearDialogRef} className="chat-clear-dialog" aria-labelledby="chat-clear-title" onCancel={event => { if (isClearing) event.preventDefault(); }}>
        <h2 id="chat-clear-title">대화 기록을 삭제할까요?</h2>
        <p>Step1의 지금까지 대화와 기억된 대화 맥락이 모두 초기화돼요. 삭제한 기록은 복구할 수 없어요.</p>
        {clearError && <p className="chat-clear-error" role="alert">{clearError}</p>}
        <div className="chat-clear-actions">
          <button type="button" className="chat-clear-cancel" autoFocus disabled={isClearing} onClick={() => clearDialogRef.current?.close()}>취소</button>
          <button type="button" className="chat-clear-confirm" disabled={isClearing || isLoading || isSubmitting} onClick={() => void clearHistory()}>{isClearing ? '삭제 중…' : '삭제'}</button>
        </div>
      </dialog>
    </div>
  );
}

export default Chat;
