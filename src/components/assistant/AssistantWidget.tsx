import { useState } from 'react';
import { Bot } from 'lucide-react';
import AssistantChat from './AssistantChat.tsx';

const BUTTON_SIZE = 44;

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Άνοιγμα Vela, του AI βοηθού"
        title="Vela — AI Βοηθός"
        className="relative flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
        style={{
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          color: 'white',
          background: 'radial-gradient(circle at 32% 26%, #FFB870 0%, #FF8A2E 32%, #D9600A 62%, #8A3C05 100%)',
          boxShadow: [
            '0 6px 14px rgba(138, 60, 5, 0.45)',
            '0 2px 4px rgba(0, 0, 0, 0.2)',
            'inset 0 -4px 7px rgba(80, 35, 0, 0.6)',
            'inset 0 3px 4px rgba(255, 210, 160, 0.5)',
          ].join(', '),
        }}
      >
        <span
          className="pointer-events-none absolute rounded-full"
          style={{
            top: '12%',
            left: '20%',
            width: '38%',
            height: '26%',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 75%)',
            filter: 'blur(1px)',
          }}
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: 'inset 0 0 8px rgba(0,0,0,0.15)' }}
        />
        <Bot className="relative h-5 w-5 drop-shadow-sm" />
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px]">
          <AssistantChat onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
