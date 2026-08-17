import { pipeline, type ProgressInfo } from '@huggingface/transformers'
import './env'
import { SPECIALISTS, type SpecialistId } from './specialists'

type SpecialistPipeline<T extends SpecialistId> = Awaited<
  ReturnType<typeof pipeline<(typeof SPECIALISTS)[T]['task']>>
>

const instances = new Map<SpecialistId, Promise<unknown>>()

/** 0-100 aggregate download progress, forwarded straight from transformers.js. */
export type LoadProgress = (info: ProgressInfo) => void

export function loadSpecialist<T extends SpecialistId>(
  id: T,
  onProgress?: LoadProgress,
): Promise<SpecialistPipeline<T>> {
  let instance = instances.get(id)
  if (!instance) {
    const config = SPECIALISTS[id]
    instance = pipeline(config.task, config.model, {
      device: 'auto',
      dtype: 'dtype' in config ? config.dtype : undefined,
      progress_callback: onProgress,
    })
    instances.set(id, instance)
  }
  return instance as Promise<SpecialistPipeline<T>>
}

/**
 * Frees a loaded specialist's weights (ONNX session + tensors) from
 * memory and drops it from the cache — the next `loadSpecialist` call for
 * that id re-initializes it (fast: the download itself stays in the
 * browser's HTTP cache, only the in-memory session is gone).
 *
 * This is a best-effort memory optimization, not a correctness
 * requirement — `session.release()` underneath has been known to throw in
 * some backend/version combinations, and a turn that otherwise succeeded
 * must never fail just because cleanup afterwards didn't. Never throws.
 */
export async function disposeSpecialist(id: SpecialistId): Promise<void> {
  const instance = instances.get(id)
  if (!instance) return
  instances.delete(id)
  try {
    const resolved = (await instance) as { dispose(): Promise<void> }
    await resolved.dispose()
  } catch (error) {
    console.error(`[Localia agent] failed to dispose specialist "${id}" (non-fatal)`, error)
  }
}
