export interface AIConnectionState {
  mode: 'backend' | 'chatgpt';
  activeId: string | null;
  accounts: { id: string; label: string; connected: boolean }[];
  connected: boolean;
  pending: boolean;
  signingIn: boolean;
  error: string;
  models: { id: string; label: string }[];
  model: string | null;
  welcome: boolean;
}
