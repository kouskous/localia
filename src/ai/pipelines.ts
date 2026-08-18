import { pipeline, type DataType, type ProgressInfo } from '@huggingface/transformers'
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
      dtype: (config as { dtype?: DataType }).dtype,
      progress_callback: onProgress,
    })
    instances.set(id, instance)
  }
  return instance as Promise<SpecialistPipeline<T>>
}
