import { useEffect, useState } from 'react';
import { PROFILE_STORAGE_KEY, readLocalPersonaState, validateProfile } from '../persona';
import type { CharacterProfile, PersonaState } from '../persona';
import type { CharacterType } from '../types/character';

export default function usePersonaState() {
  const [state, setState] = useState<PersonaState>(readLocalPersonaState);
  const [ready, setReady] = useState(!window.step1?.getPersonaState);

  useEffect(() => {
    const api = window.step1;
    if (!api?.getPersonaState) {
      const refresh = () => setState(readLocalPersonaState());
      window.addEventListener('storage', refresh);
      return () => window.removeEventListener('storage', refresh);
    }
    let active = true;
    let received = false;
    const unsubscribe = api.onPersonaChanged(next => {
      received = true;
      setState(next);
      setReady(true);
    });
    api.getPersonaState().then(next => {
      if (active && !received && next) {
        setState(next);
        setReady(true);
      }
    }).catch(console.error);
    return () => { active = false; unsubscribe(); };
  }, []);

  const saveProfile = async (type: CharacterType, profile: CharacterProfile): Promise<boolean> => {
    const valid = validateProfile(profile);
    if (!valid) return false;
    if (window.step1?.setCharacterProfile) {
      const accepted = await window.step1.setCharacterProfile(type, valid);
      if (accepted) setState(prev => ({ ...prev, profiles: { ...prev.profiles, [type]: valid } }));
      return accepted;
    }
    // Web mode is also useful for testing without Electron.
    const profiles = { ...readLocalPersonaState().profiles, [type]: valid };
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
      setState(prev => ({ ...prev, profiles }));
      return true;
    } catch (error) {
      console.warn('캐릭터 프로필 저장 실패:', error);
      return false;
    }
  };

  return { state, ready, saveProfile };
}
