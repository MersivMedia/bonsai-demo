# 🌳 Bonsai 8B Demo

A browser-based demo of PrismML's Bonsai 8B — the first commercially viable 1-bit LLM.

## What is Bonsai?

Bonsai 8B is a revolutionary 1-bit language model:
- **1.15GB** model size (14x smaller than standard 8B models)
- **70.5%** average benchmark score (competitive with 16-bit models)
- **Runs locally** on phones, laptops, and in browsers
- **Apache 2.0** licensed

## Features

- Runs entirely in your browser via WebGPU
- No server-side inference required
- Model weights cached after first download
- Real-time token generation speed display

## Requirements

- WebGPU-enabled browser (Chrome 113+, Edge 113+)
- ~2GB RAM available
- GPU with WebGPU support

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel:
```bash
vercel
```

## Credits

- [PrismML](https://prismml.com) - Bonsai model creators
- [Transformers.js](https://github.com/huggingface/transformers.js) - WebGPU inference
