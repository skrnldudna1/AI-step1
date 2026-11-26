import { useEffect, useState } from 'react';
import type { AIConnectionState } from '../types/aiConnection';

export default function useAIConnection() {
  const [connection, setConnection] = useState<AIConnectionState | null>(null);
  useEffect(() => {
    const api = window.step1;
    if (!api?.getAIConnection) return;
    let active = true;
    let received = false;
    const unsubscribe = api.onAIConnectionChanged(state => {
      received = true;
      setConnection(state);
    });
    api.getAIConnection().then(state => {
      if (active && !received && state) setConnection(state);
    }).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, []);
  return connection;
}
