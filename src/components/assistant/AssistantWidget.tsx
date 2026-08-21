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
          background: '#FF8A2E',
          boxShadow: '0 4px 10px rgba(255, 138, 46, 0.35)',
        }}
      >
        <Bot className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px]">
          <AssistantChat onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
