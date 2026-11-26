
import type {
  CharacterType,
  CharacterReaction,
} from './character';

import type { CharacterRig, RigRegion } from './rig';
import type { ChatState, ChatResizeEdge } from './chat';
import type { AIConnectionState } from './aiConnection';
import type { CharacterProfile, PersonaState } from '../persona';

interface ReactionState {
  reaction: CharacterReaction;
  isThinking: boolean;
  isTalking: boolean;
  reactionId: number;
}

interface Step1API {
  // 채팅창 열기 및 숨기기
  toggleChat: () => void;
  openChat: () => void;
  hideChat: () => void;
  openSettings: () => void;
  getPersonaState: () => Promise<PersonaState | null>;
  setCharacterProfile: (type: CharacterType, profile: CharacterProfile) => Promise<boolean>;
  onPersonaChanged: (callback: (state: PersonaState) => void) => () => void;
  getChatFollow: () => Promise<boolean | null>;
  getChatOpacity: () => Promise<number | null>;
  setChatOpacity: (opacity: number) => void;
  onChatOpacityChanged: (callback: (opacity: number) => void) => () => void;
  setChatFollow: (follow: boolean) => void;
  onChatFollowChanged: (callback: (follow: boolean) => void) => () => void;
  moveChatWindow: (position: { dx: number; dy: number }) => void;
  finishChatMove: () => void;
  startChatResize: (edge: ChatResizeEdge, id: number) => void;
  resizeChatWindow: (payload: { id: number; dx: number; dy: number }) => void;
  finishChatResize: (id: number) => void;
  getChatState: () => Promise<ChatState | null>;
  submitChatMessage: (message: string) => Promise<boolean>;
  clearChat: () => Promise<boolean>;
  getAIConnection: () => Promise<AIConnectionState | null>;
  signInChatGPT: (id?: string | null) => Promise<AIConnectionState | null>;
  cancelAIConnection: () => Promise<AIConnectionState | null>;
  selectChatGPTAccount: (id: string) => Promise<AIConnectionState | null>;
  useBackendAI: () => Promise<AIConnectionState | null>;
  signOutChatGPT: () => Promise<AIConnectionState | null>;
  selectChatGPTModel: (id: string) => Promise<AIConnectionState | null>;
  refreshChatGPTModels: () => Promise<AIConnectionState | null>;
  dismissChatGPTWelcome: () => Promise<AIConnectionState | null>;
  openChatGPTUsage: () => void;
  analyzeRigImages: (images: string[]) => Promise<{ ok: true; regions: RigRegion[] } | { ok: false; error: string }>;
  onAIConnectionChanged: (callback: (state: AIConnectionState) => void) => () => void;
  onChatStateChanged: (callback: (state: ChatState) => void) => () => void;

  // 데스크톱 캐릭터 이동
  moveCharacter: (position: {
    dx: number;
    dy: number;
  }) => void;

  setCharacterMouseIgnored: (ignore: boolean) => void;
  onCharacterCursor: (
    callback: (point: { x: number; y: number } | null) => void
  ) => () => void;

  // 캐릭터 크기 동기화 (50~200%; 기존 설정이 없으면 null)
  setCharacterSize: (size: number) => void;
  getCharacterSize: () => Promise<number | null>;
  onCharacterSizeChanged: (
    callback: (size: number) => void
  ) => () => void;

  // 캐릭터 선택 동기화
  selectCharacter: (characterType: CharacterType) => void;

  getCharacter: () => Promise<CharacterType>;

  onCharacterChanged: (
    callback: (characterType: CharacterType) => void
  ) => () => void;

  // AI 감정 및 애니메이션 동기화
  getReactionState: () => Promise<ReactionState | null>;
  updateReaction: (patch: Partial<CharacterReaction>) => void;

  onReactionChanged: (
    callback: (state: ReactionState) => void
  ) => () => void;

  // 커스텀 캐릭터 리깅 동기화
  sendCustomRig: (rig: CharacterRig) => void;

  getCustomRig: () => Promise<CharacterRig | null>;

  onCustomRigChanged: (
    callback: (rig: CharacterRig) => void
  ) => () => void;
}

declare global {
  interface Window {
    step1?: Step1API;
  }
}

export {};
