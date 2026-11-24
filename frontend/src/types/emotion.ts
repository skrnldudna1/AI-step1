import emotionConfig from '../../electron/emotionConfig.json';

export type Emotion = keyof typeof emotionConfig;
// Thinking is a visual activity state, not an additional AI emotion.
export type VisualEmotion = Emotion | 'thinking';
export const EMOTION_CONFIG = emotionConfig;
export const EMOTIONS = Object.keys(EMOTION_CONFIG) as Emotion[];
