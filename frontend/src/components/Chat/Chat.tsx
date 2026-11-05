import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "../../types/chat";
import type { CharacterReaction } from "../../types/character";

import { sendChatMessage } from "../../api/chatApi";

import "./Chat.css";

// 부모 컴포넌트(App.tsx)에서 전달받는 함수
interface ChatProps {
  onReaction: (reaction: CharacterReaction) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

function Chat({ onReaction, onLoadingChange }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "안녕! 나는 GPT Companion이야. 오늘은 어떤 이야기를 나눠볼까?",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 새로운 메시지가 추가되면 아래로 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // 메시지 전송
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = input.trim();

    if (!trimmedMessage || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    onLoadingChange(true);

    try {
      // FastAPI 서버에 메시지 전송
      const response = await sendChatMessage(trimmedMessage);
      // Thinking Animation 테스트용 (2초 대기)

      console.log("AI 응답:", response.reply);
      console.log("캐릭터 감정:", response.reaction.emotion);
      console.log("감정 강도:", response.reaction.intensity);
      console.log("캐릭터 행동:", response.reaction.action);

      // AI 감정 데이터를 App.tsx로 전달
      onReaction(response.reaction);
    

      // AI 답변을 채팅창에 추가
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.reply,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("채팅 API 오류:", error);

      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "서버 연결에 문제가 발생했어. 잠시 후 다시 시도해 줘.",
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-message ${message.role}`}
          >
            {message.content}
          </div>
        ))}

        {isLoading && (
          <div className="chat-message assistant">
            답변을 작성하고 있어...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="메시지를 입력해 줘..."
          disabled={isLoading}
        />

        <button type="submit" disabled={isLoading || !input.trim()}>
          전송
        </button>
      </form>
    </div>
  );
}

export default Chat;