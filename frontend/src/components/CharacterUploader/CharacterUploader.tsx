import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { CharacterRig, RigGenerateResponse, RigRegion, RigRegionId } from '../../types/rig';
import { EMOTIONS, EMOTION_CONFIG } from '../../types/emotion';
import type { Emotion } from '../../types/emotion';
import { isFaceRegion, isRigRegionId, pivotForRegion, rectanglePoints } from '../../rigRegions';
import useAIConnection from '../../hooks/useAIConnection';
import RigRegionEditor from './RigRegionEditor';
import StudioIcon from '../StudioIcon';
import './CharacterUploader.css';

const API_URL = 'http://127.0.0.1:8000';
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_REFERENCES = 4;
const PRIMARY = 'primary';
type Reference = { id: string; file: File; emotion: Emotion | '' };
type Layouts = Record<string, RigRegion[]>;

interface CharacterUploaderProps { onCharacterGenerated?: (rig: CharacterRig) => void }
interface AnalysisResult {
  width: number;
  height: number;
  geometry: {
    has_transparent_background: boolean;
    features: { type: string; bounds: { x: number; y: number; width: number; height: number } }[];
  };
}
const validFile = (file: File) => FILE_TYPES.includes(file.type) && file.size > 0 && file.size <= 10 * 1024 * 1024;
const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function usePreview(file: File | null) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview?.file === file ? preview.url : null;
}

function ReferenceCard({ reference, disabled, selected, count, usedEmotions, onEmotion, onEdit, onRemove }: {
  reference: Reference; disabled: boolean; selected: boolean; count: number; usedEmotions: Emotion[];
  onEmotion: (emotion: Emotion | '') => void; onEdit: () => void; onRemove: () => void;
}) {
  const preview = usePreview(reference.file);
  return <div className={'rig-reference-card' + (selected ? ' selected' : '')}>
    <div className="rig-reference-thumb">
      {preview && <img src={preview} alt="참조 이미지" />}
      <span title={reference.file.name}>{reference.file.name}</span>
      <button type="button" disabled={disabled} onClick={onRemove} aria-label={reference.file.name + ' 참조 제거'}><StudioIcon name="close" width="12" height="12" /></button>
    </div>
    <select aria-label={reference.file.name + ' 표정 지정'} value={reference.emotion} disabled={disabled} onChange={event => onEmotion(event.target.value as Emotion | '')}>
      <option value="">분석 참고용</option>
      {EMOTIONS.filter(emotion => emotion !== 'neutral').map(emotion => <option key={emotion} value={emotion} disabled={usedEmotions.includes(emotion) && reference.emotion !== emotion}>{EMOTION_CONFIG[emotion].label} 표정</option>)}
    </select>
    <button type="button" className="rig-reference-edit" aria-pressed={selected} disabled={disabled} onClick={onEdit}>파츠 편집 {count ? `(${count})` : ''}</button>
  </div>;
}

async function encodeReference(file: File, maxSide: number) {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 16000000) throw new Error('이미지 해상도는 1,600만 픽셀 이하여야 해요.');
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지를 분석용으로 변환하지 못했어요.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { bitmap.close(); }
}

function resolveRigAssets(data: RigGenerateResponse): CharacterRig {
  const resolve = (rig: CharacterRig, parentBase: URL): CharacterRig => {
    const baseUrl = rig.assetBase ? new URL(rig.assetBase, parentBase) : parentBase;
    const url = (source: string) => new URL(source, baseUrl).href;
    return {
      ...rig,
      mesh: rig.mesh ? { ...rig.mesh, src: url(rig.mesh.src) } : undefined,
      parts: rig.parts.map(part => ({
        ...part, src: url(part.src),
        variants: part.variants ? Object.fromEntries(Object.entries(part.variants).map(([emotion, source]) => [emotion, url(source)])) : undefined,
      })),
      expressions: Object.fromEntries(Object.entries(rig.expressions ?? {}).map(([emotion, parts]) =>
        [emotion, Object.fromEntries(Object.entries(parts).map(([part, source]) => [part, url(source)]))])) as CharacterRig['expressions'],
      mouthVariants: rig.mouthVariants ? {
        closed: url(rig.mouthVariants.closed), half: url(rig.mouthVariants.half), open: url(rig.mouthVariants.open),
      } : null,
      expressionRigs: rig.expressionRigs ? Object.fromEntries(Object.entries(rig.expressionRigs).map(([emotion, variant]) => [emotion, resolve(variant, baseUrl)])) : undefined,
    };
  };
  return resolve(data.rig, new URL(data.base_url, API_URL));
}

async function readResult(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(typeof data?.detail === 'string' ? data.detail : '요청에 실패했어요. 서버를 확인해 주세요.');
  return data;
}

async function analyzeLocalFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  const data: AnalysisResult = await readResult(await fetch(API_URL + '/api/character/analyze', { method: 'POST', body: form }));
  const used = new Set<RigRegionId>();
  const suggestions: RigRegion[] = [];
  for (const feature of data.geometry.features) {
    if (!isRigRegionId(feature.type) || used.has(feature.type)) continue;
    const { x, y, width, height } = feature.bounds;
    const points = rectanglePoints(
      { x: Math.max(0, x - 2) / data.width, y: Math.max(0, y - 2) / data.height },
      { x: Math.min(data.width, x + width + 2) / data.width, y: Math.min(data.height, y + height + 2) / data.height }
    );
    used.add(feature.type);
    suggestions.push({ id: feature.type, points, pivot: pivotForRegion(feature.type, points), mode: 'detail' });
  }
  return { data, suggestions };
}

export default function CharacterUploader({ onCharacterGenerated }: CharacterUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [target, setTarget] = useState(PRIMARY);
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [layouts, setLayouts] = useState<Layouts>({});
  const [preserveFace, setPreserveFace] = useState(true);
  const manuallyEdited = useRef(new Map<string, Set<RigRegionId>>());
  const [busy, setBusy] = useState<'local' | 'vision' | 'generate' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const preview = usePreview(selectedFile);
  const activeReference = references.find(reference => reference.id === target);
  const activeFile = target === PRIMARY ? selectedFile : activeReference?.file ?? null;
  const activePreview = usePreview(activeFile);
  const regions = layouts[target] ?? [];
  const size = sizes[target];
  const primaryRegions = layouts[PRIMARY] ?? [];
  const expressionReferences = references.filter(reference => reference.emotion);
  const usedEmotions = expressionReferences.map(reference => reference.emotion as Emotion);
  const connection = useAIConnection();
  const supportsVision = !!window.step1?.analyzeRigImages && connection?.mode === 'chatgpt' && connection.connected && !!connection.model && !connection.pending;
  const isBusy = busy !== null;

  useEffect(() => {
    if (!activePreview) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setSizes(previous => ({ ...previous, [target]: { width: image.naturalWidth, height: image.naturalHeight } }));
    };
    image.onerror = () => { if (active) setError('이미지를 열지 못했어요.'); };
    image.src = activePreview;
    return () => { active = false; };
  }, [activePreview, target]);

  const reset = (file: File | null = null) => {
    setSelectedFile(file);
    setReferences([]);
    setTarget(PRIMARY);
    setSizes({});
    setLayouts({});
    manuallyEdited.current.clear();
    setError('');
    setNotice('');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!validFile(file)) { setError('PNG, JPG, WEBP 이미지(각 10MB 이하)를 선택해 주세요.'); return; }
    reset(file);
  };

  const addReferences = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.some(file => !validFile(file))) { setError('참조 이미지는 PNG, JPG, WEBP이며 각각 10MB 이하여야 해요.'); return; }
    const unique = [...references];
    for (const file of files) {
      if (!unique.some(reference => sameFile(reference.file, file)) && !(selectedFile && sameFile(selectedFile, file)))
        unique.push({ id: crypto.randomUUID(), file, emotion: '' });
    }
    if (unique.length > MAX_REFERENCES) { setError('참조 이미지는 최대 4장까지 추가할 수 있어요.'); return; }
    setError('');
    setReferences(unique);
  };

  const selectTarget = (id: string) => { setTarget(id); setNotice(''); setError(''); };
  const removeReference = (id: string) => {
    setReferences(current => current.filter(reference => reference.id !== id));
    setLayouts(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    setSizes(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    manuallyEdited.current.delete(id);
    if (target === id) selectTarget(PRIMARY);
  };

  const mergeSuggestions = (suggestions: RigRegion[]) => {
    const edited = manuallyEdited.current.get(target) ?? new Set<RigRegionId>();
    setLayouts(current => ({ ...current, [target]: [
      ...(current[target] ?? []).filter(region => edited.has(region.id) || !suggestions.some(next => next.id === region.id)),
      ...suggestions.filter(region => !edited.has(region.id)),
    ] }));
  };

  const handleEditorChange = (next: RigRegion[]) => {
    const edited = manuallyEdited.current.get(target) ?? new Set<RigRegionId>();
    for (const id of new Set([...regions.map(r => r.id), ...next.map(r => r.id)])) {
      if (JSON.stringify(regions.find(r => r.id === id)) !== JSON.stringify(next.find(r => r.id === id))) edited.add(id);
    }
    manuallyEdited.current.set(target, edited);
    setLayouts(current => ({ ...current, [target]: next }));
    setNotice('');
  };

  const handleLocalAnalyze = async () => {
    if (!activeFile || isBusy) return;
    setBusy('local'); setError(''); setNotice('');
    try {
      const { data, suggestions } = await analyzeLocalFile(activeFile);
      setSizes(current => ({ ...current, [target]: { width: data.width, height: data.height } }));
      mergeSuggestions(suggestions);
      setNotice((suggestions.length ? `기본 분석 후보 ${suggestions.length}개를 찾았어요. 직접 보정해 주세요.` : '자동으로 찾은 얼굴 파츠가 없어요. 영역을 직접 그려 주세요.') +
        (!data.geometry.has_transparent_background ? ' 배경이 투명한 PNG를 권장해요.' : ''));
    } catch (e) { setError(e instanceof Error ? e.message : '이미지 분석에 실패했어요.'); }
    finally { setBusy(null); }
  };

  const handleAIAnalyze = async () => {
    if (!activeFile || !selectedFile || isBusy || !supportsVision || !window.step1) return;
    setBusy('vision'); setError(''); setNotice('');
    try {
      const main = await encodeReference(activeFile, 1024);
      const otherFiles = [selectedFile, ...references.map(reference => reference.file)].filter(file => file !== activeFile);
      const refs = await Promise.all(otherFiles.map(file => encodeReference(file, 768)));
      const result = await window.step1.analyzeRigImages([main, ...refs]);
      if (!result.ok) throw new Error(result.error);
      mergeSuggestions(result.regions);
      setNotice(result.regions.length ? `AI가 현재 이미지에서 ${result.regions.length}개의 파츠 후보를 찾았어요. 윤곽을 확인해 주세요.` : 'AI가 확실한 파츠 후보를 찾지 못했어요. 직접 영역을 지정해 주세요.');
    } catch (e) { setError(e instanceof Error ? e.message : 'AI 참조 분석에 실패했어요.'); }
    finally { setBusy(null); }
  };

  const handleGenerate = async () => {
    if (!selectedFile || isBusy || (!preserveFace && !primaryRegions.length)) return;
    setBusy('generate'); setError(''); setNotice('');
    try {
      // A primary image may benefit from local face controls even when the
      // user only registers finished expression images. The reference itself
      // needs no facial analysis and is never sent to external AI automatically.
      const checkedLayouts: Layouts = { ...layouts };
      const ensureFace = async (file: File, id: string) => {
        const existing = checkedLayouts[id] ?? [];
        if (existing.some(region => isFaceRegion(region.id)) || [...(manuallyEdited.current.get(id) ?? [])].some(isFaceRegion)) return;
        try {
          const { suggestions } = await analyzeLocalFile(file);
          const face = suggestions.filter(region => isFaceRegion(region.id));
          if (face.some(region => region.id === 'left_eye') && face.some(region => region.id === 'right_eye')) checkedLayouts[id] = [...existing, ...face];
        } catch { /* Unrecognized images keep their existing layout and normal expressions. */ }
      };
      if (expressionReferences.length) {
        if (preserveFace) await ensureFace(selectedFile, PRIMARY);
        setLayouts(checkedLayouts);
      }
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('regions', JSON.stringify(checkedLayouts[PRIMARY] ?? primaryRegions));
      form.append('preserve_face', String(preserveFace));
      if (expressionReferences.length) {
        for (const reference of expressionReferences) form.append('expression_files', reference.file);
        form.append('expression_layouts', JSON.stringify(expressionReferences.map(reference => ({ emotion: reference.emotion, regions: checkedLayouts[reference.id] ?? [] }))));
      }
      const response = await fetch(API_URL + '/api/character/generate', { method: 'POST', body: form });
      const data: RigGenerateResponse = await readResult(response);
      const rig = resolveRigAssets(data);
      onCharacterGenerated?.(rig);
      setNotice(`캐릭터를 저장했어요. ${rig.mesh ? `메시 움직임 영역 ${rig.mesh.regions.length}개` : `분리 파츠 ${rig.parts.length - 1}개`} · 등록한 실제 표정 ${Object.keys(rig.expressionRigs ?? {}).length}개. 표정 버튼으로 자연스러운 전환을 테스트해 보세요.`);
    } catch (e) { setError(e instanceof Error ? e.message : '캐릭터 생성에 실패했어요.'); }
    finally { setBusy(null); }
  };

  return <section className="character-uploader">
    <h2>나만의 캐릭터 만들기</h2>
    <p className="uploader-description">대표 그림에 움직임을 추가하고, 등록한 표정 그림으로 자연스럽게 전환할 수 있어요.</p>
    <label className="upload-area">
      {preview ? <img src={preview} className="upload-preview" alt="대표 캐릭터 미리보기" onLoad={event => {
        const image = event.currentTarget;
        setSizes(current => ({ ...current, [PRIMARY]: { width: image.naturalWidth, height: image.naturalHeight } }));
      }} onError={() => setError('이미지를 열지 못했어요. 다른 이미지를 선택해 주세요.')} /> :
        <div className="upload-placeholder"><span className="upload-symbol"><StudioIcon name="upload" width="22" height="22" /></span><p>대표 이미지 선택</p><small>PNG, JPG, WEBP · 최대 10MB · 투명 PNG 권장</small></div>}
      <input type="file" aria-label="대표 캐릭터 이미지" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} disabled={isBusy} />
    </label>
    {selectedFile && <>
      <p className="upload-filename">{selectedFile.name}{sizes[PRIMARY] ? ` · ${sizes[PRIMARY].width} × ${sizes[PRIMARY].height}` : ''}</p>
      <label className="rig-preserve-option"><input type="checkbox" checked={preserveFace} onChange={event => setPreserveFace(event.target.checked)} disabled={isBusy} />
        <span><strong>원본 그림 메시 리깅 (권장)</strong><small>원본을 자르지 않고 등록된 눈·눈썹·입과 머리·팔·다리 영역을 부드럽게 움직여요.</small></span></label>
      <div className="rig-reference-section">
        <div className="rig-reference-heading"><div><strong>표정 참고 이미지</strong><small>최대 4장 · 감정을 지정하면 해당 그림으로 부드럽게 전환돼요. 표정만 등록할 때는 AI 분석이 필요 없어요.</small></div><span>{references.length}/{MAX_REFERENCES}</span></div>
        <div className="rig-reference-grid">
          {references.map(reference => <ReferenceCard key={reference.id} reference={reference} selected={target === reference.id}
            count={(layouts[reference.id] ?? []).length} disabled={isBusy} usedEmotions={usedEmotions}
            onEmotion={emotion => setReferences(current => current.map(item => item.id === reference.id ? { ...item, emotion } : item))}
            onEdit={() => selectTarget(reference.id)} onRemove={() => removeReference(reference.id)} />)}
          {references.length < MAX_REFERENCES && <label className="rig-reference-add"><StudioIcon name="upload" width="18" height="18" /><span>표정 이미지 추가</span><input type="file" multiple aria-label="참조 이미지 추가" accept="image/png,image/jpeg,image/webp" onChange={addReferences} disabled={isBusy} /></label>}
        </div>
      </div>
      <div className="rig-target-bar">
        <button type="button" aria-pressed={target === PRIMARY} disabled={isBusy} onClick={() => selectTarget(PRIMARY)}>대표 이미지 편집</button>
        {activeReference && <span>현재 편집: {activeReference.file.name}</span>}
        {activeReference && primaryRegions.length > 0 && !regions.length && <button type="button" disabled={isBusy} onClick={() => handleEditorChange(structuredClone(primaryRegions))}>대표 영역 복사 (같은 구도)</button>}
      </div>
      <div className="upload-actions">
        <button type="button" className="upload-analyze" onClick={handleLocalAnalyze} disabled={isBusy || !activeFile}>{busy === 'local' ? '분석 중…' : '기본 얼굴 분석'}</button>
        <button type="button" className="upload-analyze rig-vision-button" onClick={handleAIAnalyze} disabled={isBusy || !supportsVision || !activeFile}>{busy === 'vision' ? 'AI 분석 중…' : 'AI 참조 분석'}</button>
        <button type="button" className="upload-reset" onClick={() => reset()} disabled={isBusy}>이미지 제거</button>
      </div>
      <p className="rig-help">{supportsVision ? 'AI 분석은 현재 편집 이미지와 다른 참조 이미지를 연결한 ChatGPT 모델에 전송해요.' : 'AI 분석은 이미지 지원 ChatGPT 모델을 연결한 데스크톱 앱에서 이용할 수 있어요. 수동 편집은 항상 가능해요.'}</p>
      {(preserveFace || activeReference) && <p className="rig-help">대표 이미지에는 메시 표정과 동작이 적용돼요. 감정에 대응하는 참고 이미지가 있으면 실제 그림으로 전환하고, 머리·팔·다리 영역을 지정한 참고 이미지에는 몸동작도 적용돼요. 등록된 참고가 없으면 기본 메시 표정을 사용해요.</p>}
      {activePreview && size && <RigRegionEditor key={target + activePreview} preview={activePreview} width={size.width} height={size.height} regions={regions} onChange={handleEditorChange} disabled={isBusy} />}
      <div className="rig-generation-actions">
        <button type="button" className="upload-reset" disabled={isBusy || !regions.length} onClick={() => { setLayouts(current => ({ ...current, [target]: [] })); manuallyEdited.current.delete(target); setNotice(''); }}>현재 영역 초기화</button>
        <button type="button" className="generate-button" disabled={isBusy || (!preserveFace && !primaryRegions.length)} onClick={handleGenerate}>{busy === 'generate' ? '파츠 분리 중…' : '캐릭터 생성 및 표정 적용'}</button>
      </div>
    </>}
    {error && <p className="upload-error" role="alert">{error}</p>}
    {notice && <p className="rig-notice" role="status">{notice}</p>}
  </section>;
}
