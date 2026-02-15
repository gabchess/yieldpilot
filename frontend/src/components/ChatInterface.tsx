'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Allocation } from '@/lib/constants';
import YieldCard from './YieldCard';

interface ChatResponse {
  recommendation: string;
  allocations?: Allocation[];
  projectedApy?: number;
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-accent-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="typing-dot w-2 h-2 rounded-full bg-accent-green/60"></div>
          <div className="typing-dot w-2 h-2 rounded-full bg-accent-green/60"></div>
          <div className="typing-dot w-2 h-2 rounded-full bg-accent-green/60"></div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isUser ? 'max-w-[80%] ml-auto' : 'max-w-[85%]'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-accent-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      )}

      <div className="flex flex-col gap-2 min-w-0">
        {/* Message bubble */}
        <div
          className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed break-words
            ${isUser
              ? 'bg-accent-green text-gray-950 rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm text-text-primary'
            }
          `}
        >
          {message.content.split('\n').map((line, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>
              {line}
            </p>
          ))}
        </div>

        {/* Allocation cards (AI messages only) */}
        {message.allocations && message.allocations.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Recommended Allocation
              </h4>
              {message.projectedApy && (
                <span className="text-xs font-mono font-bold text-accent-green">
                  {message.projectedApy.toFixed(2)}% projected
                </span>
              )}
            </div>
            {message.allocations.map((alloc, i) => (
              <YieldCard
                key={i}
                protocol={alloc.protocol}
                chain={alloc.chain}
                symbol={alloc.symbol}
                apy={alloc.apy}
                amount={alloc.amount}
                percentage={alloc.percentage}
                compact
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className={`text-[10px] text-text-tertiary ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

const SUGGESTION_PROMPTS = [
  'What are the best stablecoin yields right now?',
  'Optimize my $50K portfolio for maximum yield',
  'Show me low-risk yield opportunities on L2s',
  'Compare Aave vs Compound yields on Base',
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to YieldPilot. I\'m your AI copilot for cross-chain yield optimization. I analyze real-time DeFi yields across protocols and chains to find the best opportunities for your portfolio.\n\nTell me about your goals -- how much capital are you working with, and what\'s your risk tolerance?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [riskProfile, setRiskProfile] = useState<string>('moderate');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, riskProfile }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data: ChatResponse = await res.json();

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.recommendation,
        timestamp: new Date(),
        allocations: data.allocations,
        projectedApy: data.projectedApy,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an error analyzing yields. This could be due to a temporary API issue. Please try again in a moment.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-border bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">AI Yield Analyst</h2>
              <p className="text-xs text-text-tertiary">Powered by Claude &middot; Real-time data</p>
            </div>
          </div>

          {/* Risk profile selector */}
          <div className="flex items-center gap-1.5 bg-input rounded-lg p-0.5 border border-border">
            {['conservative', 'moderate', 'aggressive'].map((profile) => (
              <button
                key={profile}
                onClick={() => setRiskProfile(profile)}
                className={`
                  px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all cursor-pointer
                  ${riskProfile === profile
                    ? profile === 'conservative'
                      ? 'bg-accent-green/20 text-accent-green'
                      : profile === 'moderate'
                        ? 'bg-accent-amber/20 text-accent-amber'
                        : 'bg-accent-red/20 text-accent-red'
                    : 'text-text-tertiary hover:text-text-secondary'
                  }
                `}
              >
                {profile}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in-up">
            <MessageBubble message={msg} />
          </div>
        ))}
        {isLoading && <TypingIndicator />}

        {/* Suggestion chips (show only if just welcome message) */}
        {messages.length === 1 && !isLoading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTION_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-text-secondary
                  hover:border-accent-green/30 hover:text-accent-green transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-card/30">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about yields, strategies, or portfolio optimization..."
              className="w-full bg-input border border-border rounded-xl px-4 py-3 pr-12 text-sm text-text-primary
                placeholder:text-text-tertiary resize-none focus:outline-none focus:border-accent-green/50
                focus:ring-1 focus:ring-accent-green/20 transition-all min-h-[48px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent-green text-gray-950 flex items-center justify-center
              hover:bg-accent-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all
              shadow-lg shadow-accent-green/20 disabled:shadow-none cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-text-tertiary mt-2 text-center">
          YieldPilot uses real-time data from DeFi Llama. Not financial advice. DYOR.
        </p>
      </div>
    </div>
  );
}
