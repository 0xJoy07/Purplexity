// Lazy-load transformers so startup does not depend on the native sharp package.
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

let extractor: any = null;
let transformersModulePromise: Promise<any> | null = null;

async function loadTransformers() {
  transformersModulePromise ??= import("@xenova/transformers");
  return transformersModulePromise;
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!extractor) {
    console.log("Loading local embedding model: " + MODEL_NAME + "...");
    const { pipeline, env } = await loadTransformers();
    env.allowLocalModels = false;
    extractor = await pipeline("feature-extraction", MODEL_NAME);
  }

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}
