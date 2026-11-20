
import type {
  CharacterType,
  CharacterReaction,
} from './character';

import type { CharacterRig } from './rig';

interface ReactionState {
  reaction: CharacterReaction;
  isThinking: boolean;
  isTalking: boolean;
  reactionId: number;
}

interface Step1API {
  // 채팅창 열기 및 숨기기
  toggleChat: () => void;

  // 데스크톱 캐릭터 이동
  moveCharacter: (position: {
    dx: number;
    dy: number;
  }) => void;

  // 캐릭터 선택 동기화
  selectCharacter: (characterType: CharacterType) => void;

  getCharacter: () => Promise<CharacterType>;

  onCharacterChanged: (
    callback: (characterType: CharacterType) => void
  ) => () => void;

  // AI 감정 및 애니메이션 동기화
  sendReaction: (state: ReactionState) => void;

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
