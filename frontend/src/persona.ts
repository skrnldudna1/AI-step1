import config from '../electron/personaConfig.json';
import type { CharacterType } from './types/character';

export const PERSONALITIES = config.personalities;
export const TONES = config.tones;
export type Personality = keyof typeof PERSONALITIES;
export type SpeechTone = keyof typeof TONES;
export type CharacterProfile = { name: string; personality: Personality; tone: SpeechTone };
export type CharacterProfiles = Record<CharacterType, CharacterProfile>;
export type PersonaState = { characterType: CharacterType; profiles: CharacterProfiles };
export const DEFAULT_PROFILES = config.defaults as CharacterProfiles;
export const PROFILE_STORAGE_KEY = 'step1-character-profiles';
const CHARACTER_STORAGE_KEY = 'gpt-companion-character';
const characterTypes = Object.keys(DEFAULT_PROFILES) as CharacterType[];

export function validateProfile(value: unknown): CharacterProfile | null {
  if (!value || typeof value !== 'object') return null;
  const { name, personality, tone } = value as Partial<CharacterProfile>;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24 ||
      /[\x00-\x1f\x7f]/.test(name.trim())) return null;
  if (typeof personality !== 'string' || !Object.hasOwn(PERSONALITIES, personality) ||
      typeof tone !== 'string' || !Object.hasOwn(TONES, tone)) return null;
  return { name: name.trim(), personality, tone };
}

export function normalizeProfiles(value: unknown): CharacterProfiles {
  const saved = value && typeof value === 'object' ? value as Partial<CharacterProfiles> : {};
  return Object.fromEntries(characterTypes.map(type => [
    type, validateProfile(saved[type]) ?? { ...DEFAULT_PROFILES[type] },
  ])) as CharacterProfiles;
}

export function getGreeting(profile: CharacterProfile) {
  return PERSONALITIES[profile.personality].greetings[profile.tone];
}

export function readLocalPersonaState(): PersonaState {
  try {
    const savedType = localStorage.getItem(CHARACTER_STORAGE_KEY) as CharacterType | null;
    const characterType = savedType && characterTypes.includes(savedType) ? savedType : 'basic';
    return { characterType, profiles: normalizeProfiles(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? 'null')) };
  } catch {
    return { characterType: 'basic', profiles: normalizeProfiles(null) };
  }
}
