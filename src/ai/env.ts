import { env } from '@huggingface/transformers'

// Only ever fetch models from the Hugging Face Hub — never look for a
// locally-bundled copy — and let the browser's own HTTP/Cache-Storage
// caching keep repeat visits fast.
env.allowLocalModels = false
env.useBrowserCache = true
