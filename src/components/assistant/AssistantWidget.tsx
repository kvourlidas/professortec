import { useState } from 'react';
import AssistantChat from './AssistantChat.tsx';
import kikaImg from '../../assets/kika-avatar.png';

const BUTTON_SIZE = 44;

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Άνοιγμα Kika, του AI βοηθού"
        title="Kika — AI Βοηθός"
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-transform hover:scale-105 active:scale-95"
        style={{
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          background: '#FF8A2E',
          boxShadow: '0 4px 10px rgba(255, 138, 46, 0.35)',
        }}
      >
        <img src={kikaImg} alt="Kika" className="h-full w-full object-cover" />
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px]">
          <AssistantChat onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
