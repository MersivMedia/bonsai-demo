'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
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
  
  const workerRef = useRef<Worker | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check WebGPU support
    const checkWebGPU = async () => {
      if (!navigator.gpu) {
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

  const initializeModel = useCallback(async () => {
    if (loadingState === 'loading' || loadingState === 'ready') return;
    
    setLoadingState('checking');
    setStatusText('Checking WebGPU support...');

    if (!webGPUSupported) {
      setLoadingState('error');
      setStatusText('WebGPU not supported. Please use Chrome 113+ or Edge 113+.');
      return;
    }

    setLoadingState('loading');
    setStatusText('Initializing Bonsai 8B (1-bit)...');

    // Create worker for model loading
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      
      switch (type) {
        case 'progress':
          setLoadProgress(data.progress);
          setStatusText(data.text || `Loading model... ${Math.round(data.progress)}%`);
          break;
        case 'ready':
          setLoadingState('ready');
          setStatusText('Model ready!');
          break;
        case 'token':
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + data.token }];
            }
            return [...prev, { role: 'assistant', content: data.token }];
          });
          break;
        case 'done':
          setIsGenerating(false);
          setTokensPerSec(data.tokensPerSec);
          break;
        case 'error':
          setLoadingState('error');
          setStatusText(data.message || 'Failed to load model');
          setIsGenerating(false);
          break;
      }
    };

    worker.postMessage({ type: 'init' });
  }, [loadingState, webGPUSupported]);

  const sendMessage = async () => {
    if (!input.trim() || isGenerating || loadingState !== 'ready') return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setTokensPerSec(null);

    workerRef.current?.postMessage({
      type: 'generate',
      messages: [...messages, userMessage],
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                🌳 Bonsai 8B Demo
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                1-bit LLM • 1.15GB • Runs in your browser via WebGPU
              </p>
            </div>
            {tokensPerSec && (
              <div className="text-right">
                <div className="text-lg font-mono text-green-400">{tokensPerSec.toFixed(1)} tok/s</div>
                <div className="text-xs text-gray-500">Generation speed</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 flex flex-col">
        {loadingState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="text-6xl mb-6">🌳</div>
            <h2 className="text-3xl font-bold mb-4">Bonsai 8B</h2>
            <p className="text-gray-400 mb-2 max-w-md">
              The first commercially viable 1-bit LLM. 8 billion parameters compressed to just 1.15GB — 
              14x smaller than standard models with competitive performance.
            </p>
            <div className="flex gap-4 text-sm text-gray-500 mb-8">
              <span>✓ 70.5% benchmark avg</span>
              <span>✓ Apache 2.0 license</span>
              <span>✓ Runs locally</span>
            </div>
            
            {webGPUSupported === false ? (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 max-w-md">
                <p className="text-red-400 font-medium">WebGPU Not Supported</p>
                <p className="text-sm text-gray-400 mt-2">
                  Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.
                </p>
              </div>
            ) : (
              <button
                onClick={initializeModel}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold py-3 px-8 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-green-500/25"
              >
                Load Model (~1.15GB)
              </button>
            )}
            
            <p className="text-xs text-gray-600 mt-4">
              Model weights are cached in your browser after first download.
            </p>
          </div>
        )}

        {(loadingState === 'checking' || loadingState === 'loading') && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-md">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4 animate-pulse">🌳</div>
                <p className="text-gray-300">{statusText}</p>
              </div>
              <div className="bg-gray-800 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                {loadProgress.toFixed(0)}%
              </p>
            </div>
          </div>
        )}

        {loadingState === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 max-w-md text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-red-400 font-medium mb-2">Failed to Load Model</p>
              <p className="text-sm text-gray-400">{statusText}</p>
              <button
                onClick={() => setLoadingState('idle')}
                className="mt-4 text-sm text-green-400 hover:text-green-300"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {loadingState === 'ready' && (
          <>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <p className="text-lg mb-2">Model loaded! 🎉</p>
                  <p className="text-sm">Start chatting with Bonsai 8B</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isGenerating && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={isGenerating}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={isGenerating || !input.trim()}
                  className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  {isGenerating ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>
            Powered by{' '}
            <a href="https://prismml.com" target="_blank" rel="noopener" className="text-green-400 hover:text-green-300">
              PrismML Bonsai
            </a>
            {' '}• Built with{' '}
            <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noopener" className="text-green-400 hover:text-green-300">
              Transformers.js
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
