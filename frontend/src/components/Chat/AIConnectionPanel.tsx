import { useEffect, useRef, useState } from 'react';
import useAIConnection from '../../hooks/useAIConnection';
import type { AIConnectionState } from '../../types/aiConnection';

interface Props {
  busy: boolean;
  visible: boolean;
  backendLabel: string;
}

export default function AIConnectionPanel({ busy, visible, backendLabel }: Props) {
  const api = window.step1;
  const connection = useAIConnection();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const disabled = busy || working || !!connection?.pending;
  const active = connection?.accounts.find(a => a.id === connection.activeId);
  const isChatGPT = connection?.mode === 'chatgpt';

  useEffect(() => {
    const modal = dialog.current;
    if (visible && connection?.welcome && modal && !modal.open) modal.showModal();
    else if ((!visible || !connection?.welcome) && modal?.open) modal.close();
  }, [visible, connection?.welcome]);

  const run = async (action: () => Promise<AIConnectionState | null>) => {
    setWorking(true);
    setError('');
    try {
      if (!await action()) setError('대화를 마친 뒤 다시 시도해 주세요.');
    } catch {
      setError('계정 설정을 변경하지 못했어요. 다시 시도해 주세요.');
    } finally { setWorking(false); }
  };

  if (!api?.getAIConnection) return <p className="ai-web-note">ChatGPT 계정 연결은 Mac 데스크톱 앱에서 사용할 수 있어요.</p>;
  if (!connection) return <p className="ai-web-note">AI 연결 설정을 확인하는 중…</p>;

  return (
    <section className="ai-connection-panel" aria-label="AI 연결 설정">
      <div className="ai-connection-heading">
        <div>
          <p className="ai-connection-title">AI 연결</p>
          <p className="ai-connection-description">{isChatGPT ? 'ChatGPT 구독 사용량으로 대화해요.' : '기존 ChatGPT 계정을 연결해 API 키 없이 대화할 수 있어요.'}</p>
        </div>
        <span className={'ai-mode-chip' + (isChatGPT && connection.connected ? ' ai-mode-connected' : '')}>
          {isChatGPT ? (connection.connected ? 'ChatGPT 연결됨' : '연결 필요') : backendLabel || '백엔드 모드'}
        </span>
      </div>
      {active && isChatGPT && <p className="ai-account-label">현재 계정 · {active.label}</p>}
      {connection.accounts.length > 0 && <div className="ai-connection-controls">
        <label htmlFor="ai-account-picker">ChatGPT 계정</label>
        <select id="ai-account-picker" value={isChatGPT ? connection.activeId ?? '' : ''} disabled={disabled}
          onChange={e => { if (e.target.value) void run(() => api.selectChatGPTAccount(e.target.value)); }}>
          <option value="">저장된 계정 선택</option>
          {connection.accounts.map(account => <option key={account.id} value={account.id}>{account.label}{account.connected ? '' : ' (다시 로그인 필요)'}</option>)}
        </select>
      </div>}
      {isChatGPT && connection.connected && <div className="ai-connection-controls">
        <label htmlFor="ai-model-picker">모델</label>
        <select id="ai-model-picker" value={connection.model ?? ''} disabled={disabled || !connection.models.length}
          onChange={e => void run(() => api.selectChatGPTModel(e.target.value))}>
          {!connection.models.length && <option value={connection.model ?? ''}>모델 확인 필요</option>}
          {connection.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
        <button className="ai-secondary" type="button" disabled={disabled} onClick={() => void run(() => api.refreshChatGPTModels())}>새로고침</button>
      </div>}
      <div className="ai-connection-actions">
        {(!isChatGPT || !connection.connected) && <button type="button" className="ai-chatgpt-button" data-oai-siwc-button="" disabled={disabled}
          onClick={() => void run(() => api.signInChatGPT(isChatGPT ? connection.activeId : null))}>Continue with ChatGPT</button>}
        {isChatGPT && connection.connected && <>
          <button type="button" className="ai-secondary" data-oai-siwc-button="" disabled={disabled}
            onClick={() => void run(() => api.signInChatGPT(null))}>Continue with ChatGPT · 계정 추가</button>
          {connection.error && <button type="button" className="ai-secondary" disabled={disabled}
            onClick={() => void run(() => api.signInChatGPT(connection.activeId))}>계정 다시 연결</button>}
          <button type="button" className="ai-secondary" disabled={disabled} onClick={() => void run(() => api.useBackendAI())}>기존 백엔드 사용</button>
          <button type="button" className="ai-secondary" disabled={disabled} onClick={() => void run(() => api.signOutChatGPT())}>로그아웃</button>
        </>}
        {isChatGPT && !connection.connected && <button type="button" className="ai-secondary" disabled={disabled} onClick={() => void run(() => api.useBackendAI())}>기존 백엔드 사용</button>}
        {connection.signingIn && <button type="button" className="ai-secondary" disabled={busy || working} onClick={() => void run(() => api.cancelAIConnection())}>로그인 취소</button>}
        <button type="button" className="ai-text-button" onClick={() => api.openChatGPTUsage()}>사용량 관리 ↗</button>
      </div>
      {connection.pending && <p className="ai-web-note" role="status">브라우저에서 연결을 승인하거나 모델 확인이 끝날 때까지 기다려 주세요.</p>}
      {(error || connection.error) && <div className="ai-connection-error" role="alert">{error || connection.error}</div>}
      <dialog ref={dialog} className="ai-welcome-dialog" onCancel={e => { e.preventDefault(); void run(() => api.dismissChatGPTWelcome()); }}>
        <h2>ChatGPT 플랜을 사용하는 중이에요</h2>
        <p>Step1의 AI 대화는 이제 연결한 ChatGPT 구독의 사용량에 반영돼요. 사용 한도는 ChatGPT 설정에서 관리할 수 있어요.</p>
        <button type="button" className="ai-text-button" onClick={() => api.openChatGPTUsage()}>사용량 관리 ↗</button>
        <button type="button" className="studio-primary" onClick={() => void run(() => api.dismissChatGPTWelcome())}>확인</button>
      </dialog>
    </section>
  );
}
