export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    senderName?: string;
  }

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  pendingSenderName?: string | null;
}
