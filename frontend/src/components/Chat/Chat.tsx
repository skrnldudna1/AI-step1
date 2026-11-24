import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "../../types/chat";
import type { CharacterReaction } from "../../types/character";

import { sendChatMessage } from "../../api/chatApi";
import StudioIcon from "../StudioIcon";
import { DEFAULT_PROFILES, getGreeting } from '../../persona';
import type { CharacterProfile } from '../../persona';

import "./Chat.css";

// 부모 컴포넌트(App.tsx)에서 전달받는 함수
interface ChatProps {
  profile?: CharacterProfile;
  onReaction?: (reaction: CharacterReaction) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onTalkingStart?: (text: string) => void;
}

function Chat({
    profile = DEFAULT_PROFILES.basic,
    onReaction,
    onLoadingChange,
    onTalkingStart,
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
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSenderName, setPendingSenderName] = useState<string | null>(null);
  const shared = Boolean(window.step1?.submitChatMessage);
  const [isReady, setIsReady] = useState(!shared);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const submitRef = useRef(false);

  const messagesScrollRef = useRef<HTMLDivElement>(null);

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

    if (!trimmedMessage || trimmedMessage.length > 4000 || isLoading || !isReady || submitRef.current) {
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
      const response = await sendChatMessage(trimmedMessage, profile);

      // Thinking Animation 테스트용 (2초 대기)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("AI 응답:", response.reply);
      console.log("캐릭터 감정:", response.reaction.emotion);
      console.log("감정 강도:", response.reaction.intensity);
      console.log("캐릭터 행동:", response.reaction.action);

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
    <div className="chat-container">
      <div className="chat-messages" ref={messagesScrollRef} role="log" aria-label="대화 기록" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`chat-row ${message.role}`}>
            {message.role === 'assistant' && <span className="chat-avatar" aria-hidden="true"><StudioIcon name="paw" /></span>}
            <div className="chat-bubble-group">
              <span className="chat-sender">{message.role === 'assistant' ? message.senderName ?? profile.name : '나'}</span>
              <div className={`chat-message ${message.role}`}>{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-row assistant">
            <span className="chat-avatar" aria-hidden="true"><StudioIcon name="paw" /></span>
            <div className="chat-bubble-group">
              <span className="chat-sender">{pendingSenderName ?? profile.name}</span>
              <div className="chat-message assistant chat-thinking"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span> 답변을 생각하고 있어...</div>
            </div>
          </div>
        )}

        {syncError && <div className="chat-message assistant" role="alert">채팅 동기화에 문제가 발생했어. 창을 다시 열어 줘.</div>}

      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="메시지를 입력해 줘..."
          aria-label="메시지"
          maxLength={4000}
          disabled={!isReady || isLoading || isSubmitting}
        />

        <button type="submit" aria-label="전송" disabled={!isReady || isLoading || isSubmitting || !input.trim()}>
          <StudioIcon name="arrow" width="15" height="15" /> <span>전송</span>
        </button>
      </form>
    </div>
  );
}

export default Chat;
