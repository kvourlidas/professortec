import { useState, useRef, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Bot, Send, X, User, SquarePen } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient.ts';
import { useTheme } from '../../context/ThemeContext.tsx';

type ChatMessage = { role: 'user' | 'assistant'; text: string };

// Opaque conversation history returned by the assistant-chat Edge Function.
// Sent back unmodified on the next request so Claude keeps context.
type HistoryEntry = { role: string; content: unknown };

const MESSAGES_KEY = 'pt_assistant_messages_v1';
const HISTORY_KEY  = 'pt_assistant_history_v1';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type Props = {
  onClose?: () => void;
};

export default function AssistantChat({ onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage<ChatMessage[]>(MESSAGES_KEY, [])
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    loadFromStorage<HistoryEntry[]>(HISTORY_KEY, [])
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist messages and history whenever they change
  useEffect(() => {
    try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  }, [history]);

  // Scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleTextareaInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setHistory([]);
    setError(null);
    try {
      localStorage.removeItem(MESSAGES_KEY);
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    resetTextareaHeight();
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('assistant-chat', {
        body: { message: text, history },
      });

      if (fnError || !data) {
        console.error(fnError ?? data);
        setError('Κάτι πήγε στραβά. Δοκίμασε ξανά.');
        return;
      }

      setHistory(data.history ?? []);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply || '...' }]);
    } catch (err) {
      console.error(err);
      setError('Κάτι πήγε στραβά. Δοκίμασε ξανά.');
    } finally {
      setSending(false);
    }
  };

  const bubbleUser = 'bg-[color:var(--color-accent)] text-white';
  const bubbleAssistant = isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800';

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden border-l shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #FF9A3C 100%)' }}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold text-white">AI Βοηθός</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNewChat}
            aria-label="Νέα συνομιλία"
            title="Νέα συνομιλία"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <SquarePen className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Κλείσιμο"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Δοκίμασε: "Πρόσθεσε νέο μαθητή Γιώργο Παπαδόπουλο, τηλέφωνο 6900000000"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #FF9A3C 100%)' }}>
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? bubbleUser : bubbleAssistant}`}>
              {m.text}
            </div>
            {m.role === 'user' && (
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`}>
                <User className={`h-4 w-4 ${isDark ? 'text-slate-200' : 'text-slate-600'}`} />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex items-end gap-2 justify-start">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #FF9A3C 100%)' }}>
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className={`flex items-center gap-1 rounded-xl px-3 py-3 ${bubbleAssistant}`}>
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: '0.15s' }} />
              <span className="typing-dot" style={{ animationDelay: '0.30s' }} />
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t px-3 py-3" style={{ borderColor: isDark ? 'rgb(51 65 85 / 0.6)' : 'rgb(226 232 240)' }}>
        <textarea
          ref={textareaRef}
          rows={1}
          className={`flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#FF6B00]/30 focus:border-[#FF6B00] ${isDark ? 'border-[#FF6B00]/40 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-[#FF6B00]/40 bg-slate-50 text-slate-800 placeholder-slate-400'}`}
          style={{ minHeight: '36px', maxHeight: '120px', overflowY: 'auto' }}
          placeholder="Γράψε ένα μήνυμα..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={handleTextareaInput}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-85 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #FF9A3C 100%)' }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
