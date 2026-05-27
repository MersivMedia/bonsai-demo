'use client';

import { useState, useRef, useEffect } from 'react';

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
      // Dynamic import to avoid SSR issues
      const webllm = await import('@mlc-ai/web-llm');
      
      // Use a small model that works with WebLLM
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

      // Add empty assistant message for streaming
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
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                🌳 Bonsai-Style Demo
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                WebGPU LLM • Runs entirely in your browser
              </p>
            </div>
            {tokensPerSec && (
              <div className="text-right">
                <div className="text-lg font-mono text-green-400">{tokensPerSec} tok/s</div>
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
            <h2 className="text-3xl font-bold mb-4">Browser-Based LLM Demo</h2>
            <p className="text-gray-400 mb-2 max-w-md">
              Inspired by PrismML&apos;s Bonsai — running AI models directly in your browser 
              using WebGPU. No server required.
            </p>
            <div className="flex gap-4 text-sm text-gray-500 mb-8">
              <span>✓ Runs locally</span>
              <span>✓ Private</span>
              <span>✓ No API costs</span>
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
                Load Model
              </button>
            )}
            
            <div className="mt-8 p-4 bg-gray-900 rounded-lg max-w-md">
              <p className="text-sm text-gray-400">
                <strong className="text-green-400">About Bonsai:</strong> PrismML&apos;s 1-bit Bonsai 8B 
                fits an 8B parameter model in just 1.15GB — 14x smaller than standard models.
                <a href="https://prismml.com" target="_blank" rel="noopener" className="text-green-400 hover:text-green-300 ml-1">
                  Learn more →
                </a>
              </p>
            </div>
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
                {loadProgress}%
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
                  <p className="text-sm">Start chatting</p>
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
            <a href="https://webllm.mlc.ai/" target="_blank" rel="noopener" className="text-green-400 hover:text-green-300">
              WebLLM
            </a>
            {' '}• Inspired by{' '}
            <a href="https://prismml.com" target="_blank" rel="noopener" className="text-green-400 hover:text-green-300">
              PrismML Bonsai
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
