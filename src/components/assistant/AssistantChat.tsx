import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bot, Send, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient.ts';
import { useTheme } from '../../context/ThemeContext.tsx';

type ChatMessage = { role: 'user' | 'assistant'; text: string };

// Opaque conversation history returned by the assistant-chat Edge Function.
// Sent back unmodified on the next request so Claude keeps context.
type HistoryEntry = { role: string; content: unknown };

type Props = {
  onClose?: () => void;
};

export default function AssistantChat({ onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

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

  const bubbleUser = isDark ? 'bg-[color:var(--color-accent)] text-white' : 'bg-[color:var(--color-accent)] text-white';
  const bubbleAssistant = isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800';

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden border-l shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: isDark ? 'rgb(51 65 85 / 0.6)' : 'rgb(226 232 240)' }}>
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>AI Βοηθός</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Κλείσιμο"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Δοκίμασε: "Πρόσθεσε νέο μαθητή Γιώργο Παπαδόπουλο, τηλέφωνο 6900000000"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? bubbleUser : bubbleAssistant}`}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${bubbleAssistant}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> ...
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-3 py-3" style={{ borderColor: isDark ? 'rgb(51 65 85 / 0.6)' : 'rgb(226 232 240)' }}>
        <input
          className={`h-9 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`}
          placeholder="Γράψε ένα μήνυμα..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary flex h-9 w-9 items-center justify-center disabled:opacity-60">
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
