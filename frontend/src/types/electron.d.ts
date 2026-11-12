import type { CharacterType } from './character';

interface Step1API {
  selectCharacter: (characterType: CharacterType) => void;

  getCharacter: () => Promise<CharacterType>;

  onCharacterChanged: (
    callback: (characterType: CharacterType) => void
  ) => () => void;
}

declare global {
  interface Window {
    step1?: Step1API;
  }
}

export {};