import type { CharacterProfile } from '../persona';
import type { CharacterReaction } from '../types/character';
import type { ChatMessage } from '../types/chat';

export interface ChatResponse {
  reply: string;
  reaction: CharacterReaction;
  situation?: string | null;
}

export async function sendChatMessage(
  message: string,
  profile?: CharacterProfile,
  history: Pick<ChatMessage, 'role' | 'content'>[] = [],
  previousSituation?: string
): Promise<ChatResponse> {
  const response = await fetch("http://127.0.0.1:8000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, profile, history, previous_situation: previousSituation }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`채팅 요청 실패: ${response.status}`);
  }

  return (await response.json()) as ChatResponse;
}
