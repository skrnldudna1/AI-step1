import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { RigPoint, RigRegion, RigRegionId } from '../../types/rig';
import { RIG_PART_LABELS, clampPoint, isFaceRegion, moveRegion, pivotForRegion, polygonArea, rectanglePoints } from '../../rigRegions';

interface Props {
  preview: string;
  width: number;
  height: number;
  regions: RigRegion[];
  onChange: (regions: RigRegion[]) => void;
  disabled: boolean;
}
type Drag = { pointer: number; id: RigRegionId; start: RigPoint; original: RigRegion; target: 'move' | 'pivot' | number };

export default function RigRegionEditor({ preview, width, height, regions, onChange, disabled }: Props) {
  const [selected, setSelected] = useState<RigRegionId>('head');
  const [drawing, setDrawing] = useState<'polygon' | 'rectangle' | null>(null);
  const [draft, setDraft] = useState<RigPoint[]>([]);
  const [notice, setNotice] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const active = regions.find(region => region.id === selected);
  const replace = (region: RigRegion) => onChange([...regions.filter(r => r.id !== region.id), region]);
  const point = (event: PointerEvent<SVGElement>) => {
    const rect = svg.current!.getBoundingClientRect();
    return clampPoint({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  };
  const cancelDrawing = () => { setDrawing(null); setDraft([]); setNotice(''); };
  const choose = (id: RigRegionId) => { setSelected(id); cancelDrawing(); };
  const commit = (points: RigPoint[]) => {
    if (points.length < 3 || polygonArea(points) < .000001) {
      setNotice('영역이 너무 작거나 점이 부족해요. 다시 지정해 주세요.');
      return;
    }
    replace({ id: selected, points, pivot: pivotForRegion(selected, points), mode: 'region' });
    cancelDrawing();
  };
  const canvasDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || !drawing || event.button !== 0) return;
    const next = point(event);
    if (drawing === 'rectangle' && draft.length === 1) commit(rectanglePoints(draft[0], next));
    else if (draft.length < 32) setDraft(previous => [...previous, next]);
  };
  const startDrag = (event: PointerEvent<SVGElement>, region: RigRegion, target: Drag['target']) => {
    if (disabled || drawing || event.button !== 0) return;
    event.stopPropagation();
    setSelected(region.id);
    drag.current = { pointer: event.pointerId, id: region.id, start: point(event), original: region, target };
    svg.current?.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId || disabled) return;
    const next = point(event);
    const original = current.original;
    let updated: RigRegion;
    if (current.target === 'move') updated = moveRegion(original, next.x - current.start.x, next.y - current.start.y);
    else if (current.target === 'pivot') updated = { ...original, pivot: next };
    else updated = { ...original, mode: 'region', points: original.points.map((p, i) => i === current.target ? next : p) };
    if (polygonArea(updated.points) >= .000001) replace(updated);
  };
  const stop = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  };
  const coords = (points: RigPoint[]) => points.map(p => `${p.x * width},${p.y * height}`).join(' ');
  const handleRadius = Math.max(width, height) * .012;

  return <section className="rig-region-editor" aria-label="파츠 영역 편집">
    <div className="rig-editor-heading"><div><h3>파츠 영역 편집</h3><p>자동 분석은 후보를 표시해요. 실제 분리할 윤곽과 회전 중심을 확인해 주세요.</p></div><span>{regions.length}개</span></div>
    <div className="rig-editor-toolbar">
      <label>파츠 <select value={selected} onChange={e => choose(e.target.value as RigRegionId)} disabled={disabled}>
        {Object.entries(RIG_PART_LABELS).map(([id, label]) => <option key={id} value={id}>{label}{regions.some(r => r.id === id) ? ' ✓' : ''}</option>)}
      </select></label>
      <button type="button" disabled={disabled} aria-pressed={drawing === 'rectangle'} onClick={() => { setDrawing('rectangle'); setDraft([]); setNotice(''); }}>사각형 지정</button>
      <button type="button" disabled={disabled} aria-pressed={drawing === 'polygon'} onClick={() => { setDrawing('polygon'); setDraft([]); setNotice(''); }}>윤곽 그리기</button>
      {active && !drawing && <button type="button" disabled={disabled} onClick={() => onChange(regions.filter(r => r.id !== selected))}>이 파츠 제거</button>}
    </div>
    {drawing && <div className="rig-editor-drawing">
      <span>{drawing === 'rectangle' ? '이미지에서 영역의 두 대각선 모서리를 클릭하세요.' : '실제 윤곽을 따라 점을 3개 이상 클릭하세요.'}</span>
      {drawing === 'polygon' && <><button type="button" disabled={draft.length < 3 || disabled} onClick={() => commit(draft)}>완료 ({draft.length})</button><button type="button" disabled={!draft.length || disabled} onClick={() => setDraft(p => p.slice(0, -1))}>점 취소</button></>}
      <button type="button" onClick={cancelDrawing}>취소</button>
    </div>}
    {notice && <p className="upload-error" role="alert">{notice}</p>}
    <div className="rig-editor-stage">
      <svg ref={svg} viewBox={`0 0 ${width} ${height}`} className={drawing ? 'drawing' : ''} style={{ width: `min(100%, ${Math.min(700, 470 * width / height)}px)` }}
        onPointerDown={canvasDown} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
        <image href={preview} x={0} y={0} width={width} height={height} />
        <g style={{ pointerEvents: drawing ? 'none' : undefined }}>
          {regions.map(region => <polygon key={region.id} points={coords(region.points)} className={`rig-region-shape${region.id === selected ? ' selected' : ''}`}
            onPointerDown={event => startDrag(event, region, 'move')} />)}
          {active && !drawing && <>
            {active.points.map((p, index) => <circle key={index} cx={p.x * width} cy={p.y * height} r={handleRadius} className="rig-region-vertex"
              onPointerDown={event => startDrag(event, active, index)} />)}
            <circle cx={active.pivot.x * width} cy={active.pivot.y * height} r={handleRadius * 1.2} className="rig-region-pivot"
              onPointerDown={event => startDrag(event, active, 'pivot')} />
          </>}
        </g>
        {draft.length > 0 && <g style={{ pointerEvents: 'none' }}>
          <polyline points={coords(draft)} className="rig-region-draft" />
          {draft.map((p, i) => <circle key={i} cx={p.x * width} cy={p.y * height} r={handleRadius} className="rig-region-vertex" />)}
        </g>}
      </svg>
    </div>
    <div className="rig-editor-parts">{regions.length ? regions.map(region => <button key={region.id} type="button" aria-pressed={selected === region.id} disabled={disabled} onClick={() => choose(region.id)}>{RIG_PART_LABELS[region.id]}</button>) : <span>아직 지정된 파츠가 없어요. 분석하거나 파츠를 선택해 직접 그려 주세요.</span>}</div>
    {active && !drawing && <div className="rig-editor-footer">
      <span>윤곽 점을 드래그해 보정 · 주황색 점은 회전 중심</span>
      {isFaceRegion(active.id) && <label><input type="checkbox" checked={active.mode === 'detail'} disabled={disabled} onChange={e => replace({ ...active, mode: e.target.checked ? 'detail' : 'region' })} /> 어두운 특징만 추출</label>}
    </div>}
  </section>;
}
