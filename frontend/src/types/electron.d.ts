import type { CharacterType, CharacterReaction } from './character';

interface ReactionState {
  reaction: CharacterReaction;
  isThinking: boolean;
  isTalking: boolean;
  reactionId: number;
}

interface Step1API {
    toggleChat: () => void;

    moveCharacter: (position: {
        dx: number;
        dy: number;
      }) => void;

  selectCharacter: (characterType: CharacterType) => void;

  getCharacter: () => Promise<CharacterType>;

  onCharacterChanged: (
    callback: (characterType: CharacterType) => void
  ) => () => void;

  sendReaction: (state: ReactionState) => void;

  onReactionChanged: (
    callback: (state: ReactionState) => void
  ) => () => void;
}

declare global {
  interface Window {
    step1?: Step1API;
  }
}

export {};