// Helper: Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface SemanticCacheEntry {
  question: string;
  embedding: number[];
  result: any;
}

class SemanticCache {
  private cache: SemanticCacheEntry[] = [];

  // Add a new entry to the cache
  add(question: string, embedding: number[], result: any) {
    this.cache.push({ question, embedding, result });
  }

  // Find the most similar question in the cache
  findMostSimilar(embedding: number[]): { entry: SemanticCacheEntry | null, similarity: number } {
    let bestEntry: SemanticCacheEntry | null = null;
    let bestSim = -1;
    for (const entry of this.cache) {
      const sim = cosineSimilarity(entry.embedding, embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestEntry = entry;
      }
    }
    return { entry: bestEntry, similarity: bestSim };
  }
}

// Singleton instance
export const semanticCache = new SemanticCache(); 