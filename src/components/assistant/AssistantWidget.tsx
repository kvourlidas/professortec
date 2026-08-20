import { useEffect, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import AssistantChat from './AssistantChat.tsx';

const STORAGE_KEY = 'pt_assistant_widget_pos_v1';
const BUTTON_SIZE = 94;
const MARGIN = 12;

type Pos = { x: number; y: number };

function defaultPos(): Pos {
  return {
    x: window.innerWidth - BUTTON_SIZE - 20,
    y: window.innerHeight - BUTTON_SIZE - 20,
  };
}

function clamp(pos: Pos): Pos {
  const maxX = window.innerWidth - BUTTON_SIZE - MARGIN;
  const maxY = window.innerHeight - BUTTON_SIZE - MARGIN;
  return {
    x: Math.min(Math.max(pos.x, MARGIN), Math.max(maxX, MARGIN)),
    y: Math.min(Math.max(pos.y, MARGIN), Math.max(maxY, MARGIN)),
  };
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return clamp(JSON.parse(saved));
    } catch {
      // ignore malformed storage
    }
    return defaultPos();
  });

  const dragging = useRef(false);
  const moved = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    moved.current = true;
    setPos(
      clamp({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
    if (!moved.current) {
      setOpen((v) => !v);
    }
  };

  if (open) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px]">
        <AssistantChat onClose={() => setOpen(false)} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      aria-label="Άνοιγμα AI βοηθού (σύρε για μετακίνηση)"
      className="fixed z-50 flex touch-none items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95"
      style={{
        left: pos.x,
        top: pos.y,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        background: '#FF6B00',
        color: 'white',
        boxShadow: '0 8px 24px rgba(255, 107, 0, 0.45)',
      }}
    >
      <Bot className="h-7 w-7" />
    </button>
  );
}
