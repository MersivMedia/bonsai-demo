import { pipeline, env, TextGenerationPipeline } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

let generator: TextGenerationPipeline | null = null;

// Model configuration - using Bonsai 8B WebGPU version
const MODEL_ID = 'webml-community/Bonsai-8B-ONNX';

self.onmessage = async (e: MessageEvent) => {
  const { type, messages } = e.data;

  switch (type) {
    case 'init':
      await initModel();
      break;
    case 'generate':
      await generate(messages);
      break;
  }
};

async function initModel() {
  try {
    self.postMessage({ type: 'progress', data: { progress: 5, text: 'Loading Bonsai 8B model...' } });

    generator = await pipeline('text-generation', MODEL_ID, {
      dtype: 'q4', // Use quantized version for WebGPU
      device: 'webgpu',
      progress_callback: (progress: any) => {
        if (progress.status === 'progress') {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          self.postMessage({
            type: 'progress',
            data: { 
              progress: pct, 
              text: `Downloading ${progress.file}... ${pct}%` 
            }
          });
        } else if (progress.status === 'done') {
          self.postMessage({
            type: 'progress',
            data: { progress: 100, text: 'Initializing model...' }
          });
        }
      }
    });

    self.postMessage({ type: 'ready' });
  } catch (error: any) {
    console.error('Model init error:', error);
    
    // If the specific model isn't available, provide helpful error
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      self.postMessage({
        type: 'error',
        data: { 
          message: 'Bonsai WebGPU model not yet available. Check prismml.com for updates.' 
        }
      });
    } else {
      self.postMessage({
        type: 'error',
        data: { message: error.message || 'Failed to load model' }
      });
    }
  }
}

async function generate(messages: Array<{ role: string; content: string }>) {
  if (!generator) {
    self.postMessage({ type: 'error', data: { message: 'Model not loaded' } });
    return;
  }

  try {
    // Format messages into a prompt
    const prompt = messages.map(m => {
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      return m.content;
    }).join('\n') + '\nAssistant:';

    const startTime = performance.now();
    let tokenCount = 0;

    const output = await generator(prompt, {
      max_new_tokens: 512,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
      callback_function: (output: any) => {
        // Stream tokens as they're generated
        if (output && output[0]?.generated_text) {
          const newText = output[0].generated_text.slice(prompt.length);
          const lastToken = newText.slice(-1);
          tokenCount++;
          self.postMessage({ type: 'token', data: { token: lastToken } });
        }
      }
    });

    const endTime = performance.now();
    const elapsedSec = (endTime - startTime) / 1000;
    const tokensPerSec = tokenCount / elapsedSec;

    // Extract just the assistant's response
    let response = '';
    if (Array.isArray(output) && output[0]?.generated_text) {
      response = output[0].generated_text.slice(prompt.length).trim();
    }

    self.postMessage({ 
      type: 'done', 
      data: { 
        response, 
        tokensPerSec: Math.round(tokensPerSec * 10) / 10 
      } 
    });
  } catch (error: any) {
    console.error('Generation error:', error);
    self.postMessage({
      type: 'error',
      data: { message: error.message || 'Generation failed' }
    });
  }
}
