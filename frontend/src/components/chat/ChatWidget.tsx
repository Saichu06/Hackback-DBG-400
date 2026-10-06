import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, X, Send, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api, ApiError } from '../../services/api.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  Admin: [
    'What can I do as an Admin?',
    'How do I add a new Accountant or Staff user?',
    'What does the KT3 test harness prove?',
  ],
  Accountant: [
    'What can I do as an Accountant?',
    'How do I post a manual journal adjustment?',
    'How is the Trial Balance calculated?',
  ],
  Staff: [
    'What can I do as Staff?',
    'How do I create and deliver an invoice?',
    'How do I record a customer payment?',
  ],
};

function storageKey(email: string | undefined): string {
  return `chat_history_${email || 'guest'}`;
}

export const ChatWidget: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load persisted conversation for this user (per-tab session only)
  useEffect(() => {
    if (!user) return;
    try {
      const saved = sessionStorage.getItem(storageKey(user.email));
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch {
      // ignore malformed storage
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user) return;
    try {
      sessionStorage.setItem(storageKey(user.email), JSON.stringify(messages.slice(-40)));
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [messages, user?.email]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const suggestions = useMemo(
    () => (user?.role ? ROLE_SUGGESTIONS[user.role] || [] : []),
    [user?.role]
  );

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);

    try {
      const res = await api.chatbot.send(trimmed, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'The assistant is temporarily unavailable. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: msg, isError: true }]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleReset = () => {
    setMessages([]);
    if (user) {
      try {
        sessionStorage.removeItem(storageKey(user.email));
      } catch {
        // ignore
      }
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        title="Ledger Assistant"
      >
        {open ? <X size={24} /> : <Bot size={24} />}
        {!open && <span className="chat-fab-dot" />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Ledger Assistant chat">
          <div className="chat-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="chat-avatar">
                <Bot size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                  Ledger Assistant
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Helping {user.role} · {user.email}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleReset}
                className="chat-icon-btn"
                title="Clear conversation"
                type="button"
              >
                <RotateCcw size={15} />
              </button>
              <button onClick={() => setOpen(false)} className="chat-icon-btn" title="Close" type="button">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="chat-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="chat-empty-state">
                <Sparkles size={28} color="#9a6a1c" style={{ marginBottom: '10px' }} />
                <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Hi {user.email.split('@')[0]}! 👋
                </p>
                <p style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Ask me anything about your <strong>{user.role}</strong> role — how to
                  create invoices, post journals, read the Trial Balance, or what
                  you're permitted to do in this app.
                </p>
                <div className="chat-suggestions">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chat-suggestion-chip"
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`chat-bubble-row ${m.role === 'user' ? 'chat-bubble-row-user' : ''}`}
              >
                <div
                  className={`chat-bubble ${
                    m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
                  } ${m.isError ? 'chat-bubble-error' : ''}`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="chat-bubble-row">
                <div className="chat-bubble chat-bubble-assistant chat-typing">
                  <Loader2 size={14} className="chat-spin" />
                  <span>Thinking…</span>
                </div>
              </div>
            )}
          </div>

          <form className="chat-input-row" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="form-input chat-input"
              placeholder="Ask about your role or the ledger…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              className="btn btn-primary chat-send-btn"
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
