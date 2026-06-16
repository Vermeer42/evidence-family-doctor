/**
 * BM25 Search Engine for medical guidelines
 *
 * Provides keyword-based retrieval with synonym expansion.
 * No external API dependencies — runs entirely locally.
 */

// Types
export interface GuidelineChunk {
  id: string;
  source: string;
  condition: string;
  title: string;
  content: string;
  evidence_level: string;
  tags: string[];
}

export interface SearchResult {
  chunk: GuidelineChunk;
  score: number;
}

// BM25 parameters
const K1 = 1.5;  // term frequency saturation
const B = 0.75;  // length normalization

/**
 * Simple Chinese tokenizer — splits on common boundaries
 * For medical text this works well since terms are 2-4 chars
 */
export function tokenize(text: string): string[] {
  // Remove punctuation and normalize
  const cleaned = text
    .toLowerCase()
    .replace(/[，。！？、；：""''（）【】\s\d.,!?;:(){}\[\]]/g, ' ')
    .trim();

  const tokens: string[] = [];

  // Extract known medical terms first (2-5 char patterns)
  // Then fall back to bigram splitting for remaining chars
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);

  for (const word of words) {
    if (word.length <= 4) {
      tokens.push(word);
    } else {
      // Split long strings into overlapping bigrams and trigrams
      for (let i = 0; i < word.length - 1; i++) {
        tokens.push(word.slice(i, i + 2));
        if (i < word.length - 2) {
          tokens.push(word.slice(i, i + 3));
        }
      }
    }
  }

  return tokens;
}

/**
 * Expand query with synonyms
 */
export function expandWithSynonyms(
  tokens: string[],
  synonyms: Record<string, string[]>
): string[] {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    // Check if this token matches any synonym key
    if (synonyms[token]) {
      for (const syn of synonyms[token]) {
        // Tokenize the synonym and add all parts
        const synTokens = tokenize(syn);
        synTokens.forEach(t => expanded.add(t));
      }
    }

    // Also check if token is part of a longer synonym key
    for (const [key, values] of Object.entries(synonyms)) {
      if (key.includes(token) || token.includes(key)) {
        values.forEach(v => {
          tokenize(v).forEach(t => expanded.add(t));
        });
      }
    }
  }

  return Array.from(expanded);
}

/**
 * BM25 search index
 */
export class BM25Index {
  private chunks: GuidelineChunk[] = [];
  private docTokens: string[][] = [];
  private avgDocLength = 0;
  private docFreq: Map<string, number> = new Map(); // how many docs contain term
  private synonyms: Record<string, string[]> = {};

  constructor(chunks: GuidelineChunk[], synonyms: Record<string, string[]>) {
    this.chunks = chunks;
    this.synonyms = synonyms;
    this.buildIndex();
  }

  private buildIndex(): void {
    let totalLength = 0;

    for (const chunk of this.chunks) {
      // Combine all searchable text
      const text = `${chunk.title} ${chunk.content} ${chunk.tags.join(' ')}`;
      const tokens = tokenize(text);
      this.docTokens.push(tokens);
      totalLength += tokens.length;

      // Count document frequency
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.docFreq.set(token, (this.docFreq.get(token) || 0) + 1);
      }
    }

    this.avgDocLength = totalLength / (this.chunks.length || 1);
  }

  /**
   * Search for relevant chunks given a query string
   */
  search(query: string, topK = 5): SearchResult[] {
    const queryTokens = tokenize(query);
    const expandedTokens = expandWithSynonyms(queryTokens, this.synonyms);

    const scores: { chunk: GuidelineChunk; score: number }[] = [];
    const N = this.chunks.length;

    for (let i = 0; i < this.chunks.length; i++) {
      const docTokens = this.docTokens[i];
      const docLength = docTokens.length;
      let score = 0;

      // Count term frequencies in this doc
      const tf = new Map<string, number>();
      for (const token of docTokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      for (const term of expandedTokens) {
        const termFreq = tf.get(term) || 0;
        if (termFreq === 0) continue;

        const df = this.docFreq.get(term) || 0;
        // IDF with smoothing
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        // BM25 term score
        const tfNorm =
          (termFreq * (K1 + 1)) /
          (termFreq + K1 * (1 - B + B * (docLength / this.avgDocLength)));

        score += idf * tfNorm;
      }

      if (score > 0) {
        scores.push({ chunk: this.chunks[i], score });
      }
    }

    // Sort by score descending, return top K
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}
