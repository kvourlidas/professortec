import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useOutsideClose(refs: Array<RefObject<HTMLElement | null>>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: MouseEvent) => { if (!refs.some(r => r.current?.contains(e.target as Node))) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [enabled, onClose, refs]);
}
