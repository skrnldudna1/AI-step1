import type { CharacterProfile } from '../persona';
import type { CharacterReaction } from '../types/character';

export interface ChatResponse {
  reply: string;
  reaction: CharacterReaction;
}

export async function sendChatMessage(
  message: string,
  profile?: CharacterProfile
): Promise<ChatResponse> {
  const response = await fetch("http://127.0.0.1:8000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, profile }),
  });

  if (!response.ok) {
    throw new Error(`채팅 요청 실패: ${response.status}`);
  }

  return (await response.json()) as ChatResponse;
}
