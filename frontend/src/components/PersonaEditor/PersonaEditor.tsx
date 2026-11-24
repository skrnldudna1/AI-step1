import { useState } from 'react';
import type { FormEvent } from 'react';
import { DEFAULT_PROFILES, PERSONALITIES, TONES, getGreeting, validateProfile } from '../../persona';
import type { CharacterProfile, Personality, SpeechTone } from '../../persona';
import type { CharacterType } from '../../types/character';
import StudioIcon from '../StudioIcon';
import './PersonaEditor.css';

interface Props {
  type: CharacterType;
  characterLabel: string;
  profile: CharacterProfile;
  onSave: (profile: CharacterProfile) => Promise<boolean>;
}

const personalityMarks: Record<Personality, string> = { warm: '♡', playful: '✦', calm: '☾', focused: '◎' };

export default function PersonaEditor({ type, characterLabel, profile, onSave }: Props) {
  const [draft, setDraft] = useState<CharacterProfile>({ ...profile });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const valid = validateProfile(draft);
  const changed = draft.name.trim() !== profile.name || draft.personality !== profile.personality || draft.tone !== profile.tone;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !changed || saving) return;
    setSaving(true);
    setError('');
    try {
      if (!await onSave(valid)) setError('설정을 저장하지 못했어요. 다시 시도해 주세요.');
    } catch {
      setError('설정을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="persona-editor" onSubmit={handleSave}>
      <header className="card-heading">
        <div><p className="section-kicker">03 / PERSONALITY</p><h2 id="persona-title">우리만의 프로필</h2></div>
        <span className="persona-character-chip"><span /> {characterLabel} 설정 중</span>
      </header>
      <p className="card-description">캐릭터를 선택한 뒤 이름과 성격을 정해 주세요. 네 가지 캐릭터의 설정은 각각 저장돼요.</p>
      <div className="persona-grid">
        <div className="persona-identity">
          <label htmlFor="persona-name">캐릭터 이름</label>
          <div className="persona-name-field">
            <input id="persona-name" value={draft.name} maxLength={24} required
              onChange={event => setDraft(prev => ({ ...prev, name: event.target.value }))}
              placeholder="친구의 이름을 지어 주세요" />
            <span>{draft.name.length}/24</span>
          </div>
          <div className="persona-field-title">말투</div>
          <div className="persona-tone-options" role="group" aria-label="말투 선택">
            {(Object.entries(TONES) as [SpeechTone, typeof TONES[SpeechTone]][]).map(([tone, item]) =>
              <button key={tone} type="button" className="persona-tone-option" aria-pressed={draft.tone === tone}
                onClick={() => setDraft(prev => ({ ...prev, tone }))}>
                <strong>{item.label}</strong><span>{item.description}</span>
              </button>
            )}
          </div>
        </div>
        <div className="persona-character">
          <div className="persona-field-title">성격</div>
          <div className="persona-personality-options" role="group" aria-label="성격 선택">
            {(Object.entries(PERSONALITIES) as [Personality, typeof PERSONALITIES[Personality]][]).map(([personality, item]) =>
              <button key={personality} type="button" className="persona-personality-option" aria-pressed={draft.personality === personality}
                onClick={() => setDraft(prev => ({ ...prev, personality }))}>
                <span className="persona-mark">{personalityMarks[personality]}</span>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="persona-sample">
        <span className="persona-sample-avatar"><StudioIcon name="paw" /></span>
        <div><strong>{draft.name.trim() || '이름 없는 친구'} <small>· 인사 미리보기</small></strong><p>{getGreeting(draft)}</p></div>
      </div>
      <div className="persona-footer">
        <button type="button" className="persona-reset" onClick={() => setDraft({ ...DEFAULT_PROFILES[type] })}><StudioIcon name="reset" width="15" height="15" /> 기본 설정</button>
        <span className="persona-save-status" role="status">{error || (changed ? '저장 전 변경 사항이 있어요.' : '저장된 프로필이에요.')}</span>
        <button type="submit" className="studio-primary" disabled={!valid || !changed || saving}>{saving ? '저장 중…' : '프로필 저장'}</button>
      </div>
    </form>
  );
}
