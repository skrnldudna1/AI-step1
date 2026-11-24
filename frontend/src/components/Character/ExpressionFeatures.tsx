import type { VisualEmotion } from '../../types/emotion';
import './ExpressionFeatures.css';

type Side = 'left' | 'right';
interface EyeProps { emotion: VisualEmotion; side: Side; x: number; y: number; scale?: number; blink?: boolean; autoBlink?: boolean }

export function ExpressionEye({ emotion, side, x, y, scale = 1, blink = false, autoBlink = false }: EyeProps) {
  const direction = side === 'left' ? 1 : -1;
  const eye = (() => {
    if (blink) return <path d="M-10 1 Q0 5 10 1" />;
    switch (emotion) {
      case 'thinking': return <ellipse cx="2" cy="-1" rx="6.1" ry="8.2" fill="currentColor" stroke="none" />;
      case 'happy': return <path d="M-10 3 Q0 -9 10 3" />;
      case 'excited': return <><path d="M-11 3 Q0 -12 11 3" strokeWidth="3.5" /><path d="M-10 -16 Q0 -20 10 -16" strokeWidth="2.4" /></>;
      case 'sad': return <><ellipse cy="2" rx="6.5" ry="8" fill="currentColor" stroke="none" transform={`rotate(${direction * 17})`}/><path d={direction === 1 ? 'M-11 -12 Q0 -14 9 -19' : 'M-9 -19 Q0 -14 11 -12'} /></>;
      case 'shy': return <><ellipse cx={4} cy="3" rx="6" ry="6.5" fill="currentColor" stroke="none"/><path d="M-10 -8 Q0 -11 9 -8" strokeWidth="2" /></>;
      case 'angry': return <><path d={direction === 1 ? 'M-11 -16 L10 -8' : 'M-10 -8 L11 -16'} strokeWidth="3.8" /><ellipse rx="7.5" ry="4.8" cy="3" fill="currentColor" stroke="none" transform={`rotate(${direction * 13})`}/></>;
      case 'confused': return <><ellipse rx={side === 'left' ? 7 : 5.5} ry={side === 'left' ? 10 : 6} cy="1" fill="currentColor" stroke="none"/><path d={side === 'left' ? 'M-10 -16 Q0 -22 10 -15' : 'M-10 -12 L9 -12'} /></>;
      case 'sleepy': return <><ellipse rx="6.5" ry="2.5" cy="4.5" fill="currentColor" stroke="none"/><path d="M-11 -1 Q0 2 11 -1" strokeWidth="3.2" /></>;
      case 'surprised': return <><ellipse rx="11" ry="14" fill="currentColor" stroke="none"/><ellipse cx="-3" cy="-4" rx="3" ry="4.2" fill="#fff7eb" stroke="none"/><path d="M-9 -20 Q0 -23 9 -20" strokeWidth="2.2"/></>;
      case 'playful': return side === 'right' ? <path d="M-11 3 L0 -4 L10 3" strokeWidth="3.4" /> : <><ellipse rx="8" ry="11" fill="currentColor" stroke="none"/><circle cx="-2.5" cy="-4" r="2.7" fill="#fff8ee" stroke="none"/></>;
      case 'affectionate': return <path d="M-11 3 Q0 -10 11 3" strokeWidth="3.5" />;
      default: return <ellipse rx="6.3" ry="9.3" fill="currentColor" stroke="none"/>;
    }
  })();
  const canBlink = autoBlink && ['neutral', 'sad', 'shy', 'angry', 'confused', 'surprised', 'thinking'].includes(emotion);
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <g className={canBlink ? 'expression-eye-blink' : undefined}>{eye}</g>
  </g>;
}

interface MouthProps { emotion: VisualEmotion; x: number; y: number; scale?: number; talking?: boolean }
export function ExpressionMouth({ emotion, x, y, scale = 1, talking = false }: MouthProps) {
  const shape = (() => {
    if (talking) return <><ellipse rx="11" ry="8" fill="#a96162" stroke="currentColor" /><path d="M-5 4 Q0 0 5 4" stroke="#ffd4c2" strokeWidth="2"/></>;
    switch (emotion) {
      case 'thinking': return <path d="M-8 0 Q0 4 8 0" strokeWidth="2.3" />;
      case 'happy': return <path d="M-20 -4 Q0 22 20 -4" strokeWidth="3.6"/>;
      case 'excited': return <><path d="M-17 -6 Q0 0 17 -6 Q15 22 0 22 Q-15 22 -17 -6Z" fill="#a45d58" strokeWidth="2.4"/><path d="M-9 14 Q0 6 9 14 Q4 20 0 20 Q-5 20 -9 14" fill="#f5a0a2" stroke="none"/></>;
      case 'sad': return <path d="M-14 6 Q0 -11 14 6" strokeWidth="3" />;
      case 'shy': return <path d="M-7 1 Q0 7 7 1" strokeWidth="2.4" />;
      case 'angry': return <path d="M-13 5 Q0 -5 13 5" strokeWidth="3.5" />;
      case 'confused': return <path d="M-12 1 Q-5 -7 0 0 T12 -2" strokeWidth="2.9"/>;
      case 'sleepy': return <ellipse rx="7" ry="5" strokeWidth="2.5" />;
      case 'surprised': return <ellipse rx="11" ry="15" fill="#ad716d" strokeWidth="2.8" />;
      case 'playful': return <path d="M-14 1 Q0 14 14 -5" strokeWidth="3.1" />;
      case 'affectionate': return <path d="M-16 -2 Q0 17 16 -2" strokeWidth="3.1"/>;
      default: return <path d="M-19 -3 Q0 14 19 -3" strokeWidth="2.7" />;
    }
  })();
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4">
    <g className={talking ? 'expression-mouth-speaking' : undefined}>{shape}</g>
  </g>;
}

interface AccentsProps { emotion: VisualEmotion; x: number; y: number; scale?: number; intensity?: number }
export function ExpressionAccents({ emotion, x, y, scale = 1, intensity = 0.5 }: AccentsProps) {
  const opacity = 0.45 + Math.max(0, Math.min(intensity, 1)) * 0.55;
  return <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} aria-hidden="true">
    {['shy', 'affectionate', 'excited', 'happy'].includes(emotion) && <g className="expression-blush">
      {[-1, 1].map(side => <g key={side} transform={`translate(${side * 43} 23)`}><ellipse rx={emotion === 'shy' ? 13 : 10} ry="6.5" fill="#ef9a9c" opacity=".58" />
        {emotion === 'shy' && <path d="M-7 3 L-3 -3 M1 3 L5 -3" stroke="#df797b" strokeWidth="1.5" strokeLinecap="round"/>}</g>)}
    </g>}
    {emotion === 'affectionate' && <g className="expression-hearts" fill="#e88091">
      <path d="M-48 -38 C-57 -47 -67 -34 -48 -23 C-30 -34 -39 -47 -48 -38Z"/>
      <path d="M47 -48 C39 -56 31 -44 47 -34 C64 -44 55 -56 47 -48Z" opacity=".85"/>
    </g>}
    {emotion === 'sleepy' && <g fill="none" stroke="#967aab" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M41 -23 h11 l-11 12 h11 M56 -38 h8 l-8 9 h8" />
    </g>}
    {emotion === 'sad' && <path d="M-26 13 Q-36 27 -26 31 Q-17 27 -26 13Z" fill="#92b8db" stroke="#6c97b9" strokeWidth=".8"/>}
    {emotion === 'confused' && <g fill="none" stroke="#82a6c0" strokeWidth="2.2" strokeLinecap="round"><path d="M45 -22 Q53 -8 45 -6 Q37 -8 45 -22Z" fill="#b8d7e5"/></g>}
    {emotion === 'angry' && <g fill="none" stroke="#bf7871" strokeWidth="2.8" strokeLinecap="round"><path d="M38 -37 q7 1 7 -7 M50 -44 q0 7 7 7 M38 -31 q7 -1 7 7 M50 -24 q0 -7 7 -7"/></g>}
    {emotion === 'excited' && <g fill="#e8b169"><path d="M-56 -27 l4 8 8 4 -8 4 -4 8 -4-8 -8-4 8-4Z"/><path d="M53 -35 l3 6 6 3 -6 3 -3 6 -3-6 -6-3 6-3Z"/></g>}
  </g>;
}
