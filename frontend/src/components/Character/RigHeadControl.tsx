import type { CharacterRig } from '../../types/rig';
import { getRigHeadPlan, getRigSplitRange } from '../../headRig';

interface Props { rig: CharacterRig; onChange: (value: number | undefined) => void; onGuide: (show: boolean) => void }

export default function RigHeadControl({ rig, onChange, onGuide }: Props) {
  const plan = getRigHeadPlan(rig);
  const range = getRigSplitRange(rig);
  const adjustable = plan.mode !== 'separate' && plan.base && range.min < range.max;
  const position = Math.round(Math.max(range.min, Math.min(range.max, plan.neckY)));
  return <details className="rig-head-control">
    <summary>머리·몸 분리 설정 <span>{rig.headSplit !== undefined ? '수동' : '자동'}</span></summary>
    <p>{plan.mode === 'separate' ? '분리된 머리 파츠를 사용하고 있어요.' : plan.mode === 'clipped'
      ? '고개만 움직이도록 목 위치에서 머리와 몸을 나눴어요.'
      : '머리와 몸의 경계가 확실하지 않아 캐릭터 전체를 머리로 처리해요.'}</p>
    {adjustable && <>
      <div className="rig-head-label"><label htmlFor="rig-neck-position">목 위치</label><output htmlFor="rig-neck-position">{position}%</output></div>
      <input id="rig-neck-position" type="range" min={range.min} max={range.max} step={1} value={position}
        onFocus={() => onGuide(true)} onBlur={() => onGuide(false)}
        onPointerDown={() => onGuide(true)} onPointerUp={() => onGuide(false)} onPointerCancel={() => onGuide(false)}
        onChange={event => onChange(Number(event.target.value))} />
      <div className="rig-head-footer"><small>미리보기에서 점선 위치를 맞추고 끄덕임을 테스트해 보세요.</small>
        <button type="button" onClick={() => { onChange(undefined); onGuide(false); }}>자동 분리</button></div>
    </>}
  </details>;
}
