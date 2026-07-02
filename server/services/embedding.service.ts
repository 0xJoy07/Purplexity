import { pipeline, env } from '@xenova/transformers';

// Skip local model check since we'll download on first run
env.allowLocalModels = false;

// We use a lightweight local embedding model. all-MiniLM-L6-v2 produces a 384-dimensional vector.
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

let extractor: any = null;

export async function getEmbedding(text: string): Promise<number[]> {
  if (!extractor) {
    console.log(`Loading local embedding model: ${MODEL_NAME}...`);
    // @ts-ignore
    extractor = await pipeline('feature-extraction', MODEL_NAME);
  }

  // @ts-ignore
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}
