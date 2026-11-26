import type { SVGProps } from 'react';

type IconName = 'paw' | 'home' | 'palette' | 'sparkles' | 'chat' | 'smile' |
  'arrow' | 'external' | 'pin' | 'link' | 'settings' | 'close' | 'upload' | 'reset' | 'opacity' | 'trash';

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export default function StudioIcon({ name, ...props }: Props) {
  let content;
  switch (name) {
    case 'paw':
      content = <g fill="currentColor" stroke="none">
        <ellipse cx="7" cy="7.2" rx="2.6" ry="3.4" transform="rotate(-23 7 7.2)" />
        <ellipse cx="16.9" cy="7.2" rx="2.6" ry="3.4" transform="rotate(23 16.9 7.2)" />
        <ellipse cx="3.4" cy="12.3" rx="2.3" ry="2.8" transform="rotate(-35 3.4 12.3)" />
        <ellipse cx="20.6" cy="12.3" rx="2.3" ry="2.8" transform="rotate(35 20.6 12.3)" />
        <path d="M12 11c-2.5 0-3.9 2.3-6 4.8C3.7 18.6 5.4 22 8.4 21.3c1.4-.3 2.5-1.1 3.6-1.1s2.2.8 3.6 1.1c3 .7 4.7-2.7 2.4-5.5C15.9 13.3 14.5 11 12 11Z" />
      </g>;
      break;
    case 'home': content = <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-7h6v7"/></>; break;
    case 'palette': content = <><path d="M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.3-3l1.8.1A3.5 3.5 0 0 0 22 11c0-4.5-4.6-8-10-8Z"/><path d="M7.5 11h.01M10 6.8h.01M15 7h.01M18.2 11h.01" strokeWidth="3"/></>; break;
    case 'sparkles': content = <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m5 16 1 2.5 2.5 1L6 20.5 5 23l-1-2.5-2.5-1L4 18.5 5 16ZM20 2v4m-2-2h4"/></>; break;
    case 'chat': content = <path d="M20.8 11.5a8.8 8.8 0 0 1-9.1 8.5 10 10 0 0 1-3.5-.6L3 21l1.6-4.4A8 8 0 0 1 3 11.5C3 6.8 6.8 3 12 3s8.8 3.8 8.8 8.5Z"/>; break;
    case 'smile': content = <><circle cx="12" cy="12" r="9"/><path d="M8 14c1.2 2.7 6.8 2.7 8 0M8.5 9.5h.01m7 0h.01" strokeWidth="2"/></>; break;
    case 'arrow': content = <><path d="m4 12 15-8-4 16-3.6-6.5L4 12Z"/><path d="m11.4 13.5 7.6-9.5"/></>; break;
    case 'external': content = <><path d="M14 4h6v6m0-6-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></>; break;
    case 'pin': content = <><path d="m9 4 11 11-4 1-3 4-1-5-5-5-5-1 4-3 3-2Z"/><path d="m10 14-6 6"/></>; break;
    case 'link': content = <><path d="m10 13 4-4M8 16l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 8a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1"/></>; break;
    case 'settings': content = <><path d="m10 3-.7 2.5-2 .9L5 5l-2 2 1.4 2.3-.8 2.1L1.5 12l1.1 3 2.5-.2 1.6 1.6-.2 2.5 3 1.1 1.3-2.1 2.2-.1 1.4 2.2 3-1.1-.2-2.5 1.6-1.6 2.5.2 1.1-3-2.1-.6-.8-2.1L21 7l-2-2-2.3 1.4-2-.9L14 3Z"/><circle cx="12" cy="12" r="3"/></>; break;
    case 'close': content = <path d="m6 6 12 12M18 6 6 18"/>; break;
    case 'upload': content = <><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/></>; break;
    case 'reset': content = <><path d="M3 10a9 9 0 1 1 2 7M3 4v6h6"/></>; break;
    case 'opacity': content = <><path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/><path d="M5 15h14M9 18h6"/></>; break;
    case 'trash': content = <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></>; break;
  }
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{content}</svg>;
}
