'use client';

import { useState, useRef, useEffect } from 'react';
import './globals.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type LoadingState = 'idle' | 'checking' | 'loading' | 'ready' | 'error';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokensPerSec, setTokensPerSec] = useState<number | null>(null);
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  
  const engineRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkWebGPU = async () => {
      if (typeof navigator === 'undefined' || !navigator.gpu) {
        setWebGPUSupported(false);
        return;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        setWebGPUSupported(!!adapter);
      } catch {
        setWebGPUSupported(false);
      }
    };
    checkWebGPU();
  }, []);

  const initializeModel = async () => {
    if (loadingState === 'loading' || loadingState === 'ready') return;
    
    setLoadingState('checking');
    setStatusText('Checking WebGPU support...');

    if (!webGPUSupported) {
      setLoadingState('error');
      setStatusText('WebGPU not supported. Please use Chrome 113+ or Edge 113+.');
      return;
    }

    setLoadingState('loading');
    setStatusText('Initializing WebLLM...');

    try {
      const webllm = await import('@mlc-ai/web-llm');
      const modelId = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
      
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          setLoadProgress(Math.round(progress.progress * 100));
          setStatusText(progress.text || `Loading model... ${Math.round(progress.progress * 100)}%`);
        },
      });

      engineRef.current = engine;
      setLoadingState('ready');
      setStatusText('Model ready!');
    } catch (error: any) {
      console.error('Model init error:', error);
      setLoadingState('error');
      setStatusText(error.message || 'Failed to load model');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isGenerating || loadingState !== 'ready' || !engineRef.current) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);
    setTokensPerSec(null);

    try {
      const startTime = performance.now();
      let tokenCount = 0;
      let assistantContent = '';

      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      const chunks = await engineRef.current.chat.completions.create({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: 512,
        temperature: 0.7,
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          assistantContent += delta;
          tokenCount++;
          setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
        }
      }

      const endTime = performance.now();
      const elapsedSec = (endTime - startTime) / 1000;
      setTokensPerSec(Math.round((tokenCount / elapsedSec) * 10) / 10);
    } catch (error: any) {
      console.error('Generation error:', error);
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${error.message}` }]);
    }

    setIsGenerating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        borderBottom: '1px solid #1f2937', 
        background: 'rgba(17, 24, 39, 0.5)', 
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div className="container" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }} className="text-gradient">
                🌳 Bonsai-Style Demo
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                WebGPU LLM • Runs entirely in your browser
              </p>
            </div>
            {tokensPerSec && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.125rem', fontFamily: 'monospace', color: '#4ade80' }}>
                  {tokensPerSec} tok/s
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Generation speed</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container" style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column' }}>
        {loadingState === 'idle' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🌳</div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1rem' }}>Browser-Based LLM Demo</h2>
            <p style={{ color: '#9ca3af', marginBottom: '0.5rem', maxWidth: '28rem' }}>
              Inspired by PrismML&apos;s Bonsai — running AI models directly in your browser 
              using WebGPU. No server required.
            </p>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280', marginBottom: '2rem' }}>
              <span>✓ Runs locally</span>
              <span>✓ Private</span>
              <span>✓ No API costs</span>
            </div>
            
            {webGPUSupported === false ? (
              <div className="card" style={{ maxWidth: '28rem', borderColor: '#7f1d1d' }}>
                <p style={{ color: '#f87171', fontWeight: '500' }}>WebGPU Not Supported</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                  Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.
                </p>
              </div>
            ) : (
              <button onClick={initializeModel} className="btn btn-primary">
                Load Model
              </button>
            )}
            
            <div className="card" style={{ marginTop: '2rem', maxWidth: '28rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                <strong style={{ color: '#4ade80' }}>About Bonsai:</strong> PrismML&apos;s 1-bit Bonsai 8B 
                fits an 8B parameter model in just 1.15GB — 14x smaller than standard models.
                <a href="https://prismml.com" target="_blank" rel="noopener" style={{ color: '#4ade80', marginLeft: '0.25rem' }}>
                  Learn more →
                </a>
              </p>
            </div>
          </div>
        )}

        {(loadingState === 'checking' || loadingState === 'loading') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '28rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }} className="animate-pulse">🌳</div>
                <p style={{ color: '#d1d5db' }}>{statusText}</p>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${loadProgress}%` }} />
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                {loadProgress}%
              </p>
            </div>
          </div>
        )}

        {loadingState === 'error' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ maxWidth: '28rem', textAlign: 'center', borderColor: '#7f1d1d' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
              <p style={{ color: '#f87171', fontWeight: '500', marginBottom: '0.5rem' }}>Failed to Load Model</p>
              <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{statusText}</p>
              <button
                onClick={() => setLoadingState('idle')}
                style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {loadingState === 'ready' && (
          <>
            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '3rem 0' }}>
                  <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Model loaded! 🎉</p>
                  <p style={{ fontSize: '0.875rem' }}>Start chatting</p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                  >
                    <div className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isGenerating && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div className="message message-assistant">
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <div style={{ width: '0.5rem', height: '0.5rem', background: '#6b7280', borderRadius: '50%' }} className="animate-bounce" />
                        <div style={{ width: '0.5rem', height: '0.5rem', background: '#6b7280', borderRadius: '50%', animationDelay: '0.1s' }} className="animate-bounce" />
                        <div style={{ width: '0.5rem', height: '0.5rem', background: '#6b7280', borderRadius: '50%', animationDelay: '0.2s' }} className="animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid #1f2937', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={isGenerating}
                  className="input"
                  style={{ flex: 1, opacity: isGenerating ? 0.5 : 1 }}
                />
                <button
                  onClick={sendMessage}
                  disabled={isGenerating || !input.trim()}
                  className="btn btn-primary"
                >
                  {isGenerating ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1f2937', padding: '1rem 0' }}>
        <div className="container" style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
          <p>
            Powered by{' '}
            <a href="https://webllm.mlc.ai/" target="_blank" rel="noopener" style={{ color: '#4ade80' }}>
              WebLLM
            </a>
            {' '}• Inspired by{' '}
            <a href="https://prismml.com" target="_blank" rel="noopener" style={{ color: '#4ade80' }}>
              PrismML Bonsai
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
