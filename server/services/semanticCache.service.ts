import { prisma } from '../config/db.config';
import { getEmbedding } from './embedding.service';

export interface CacheMatch {
  id: string;
  response: string;
  sources: any;
  similarity: number;
}

export async function checkCache(query: string, threshold = 0.85): Promise<CacheMatch | null> {
  try {
    const embedding = await getEmbedding(query);
    
    // Format the array to pgvector string format '[1.0, 2.0, ...]'
    const embeddingStr = `[${embedding.join(',')}]`;
    
    // Perform vector similarity search
    const matches: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, response, sources, 1 - (embedding <=> $1::vector) AS similarity
      FROM semantic_cache
      WHERE 1 - (embedding <=> $1::vector) > $2
      ORDER BY similarity DESC
      LIMIT 1;
    `, embeddingStr, threshold);
    
    if (matches && matches.length > 0) {
      return matches[0] as CacheMatch;
    }
    
    return null;
  } catch (error) {
    console.error('Error checking semantic cache:', error);
    return null;
  }
}

export async function saveToCache(query: string, response: string, sources: any) {
  try {
    const embedding = await getEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;
    
    // Using raw SQL to insert because Prisma currently has limited support for inserting vectors directly without raw SQL
    await prisma.$executeRawUnsafe(`
      INSERT INTO semantic_cache (id, query, response, sources, embedding)
      VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::vector);
    `, query, response, JSON.stringify(sources), embeddingStr);
    
    console.log('Saved to semantic cache');
  } catch (error) {
    console.error('Error saving to semantic cache:', error);
  }
}
