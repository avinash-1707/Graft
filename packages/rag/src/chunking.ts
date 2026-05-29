/**
 * Deterministic, dependency-free text chunking for KB ingestion. Splits on
 * paragraph then sentence boundaries, greedily packs units up to `maxChars`, and
 * carries a word-aligned `overlapChars` tail between adjacent chunks so context
 * straddling a boundary is not lost at retrieval time. Pure: same input → same
 * chunks. Chunk-size tuning per document type is an open question (see tracker).
 */

export interface ChunkOptions {
  /** Soft upper bound on chunk length in characters. */
  maxChars?: number;
  /** Characters of trailing context repeated at the start of the next chunk. */
  overlapChars?: number;
}

export interface TextChunk {
  /** Zero-based position of this chunk within the document. */
  index: number;
  content: string;
}

export const DEFAULT_CHUNK_OPTIONS = {
  maxChars: 1200,
  overlapChars: 200,
} as const satisfies Required<ChunkOptions>;

/** Splits text into trimmed, non-empty sentence-ish units, respecting paragraphs. */
function splitUnits(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((unit) => unit.trim())
    .filter((unit) => unit.length > 0);
}

/** Word-aligned tail of `text` no longer than `overlapChars`. */
function overlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0) return '';
  const tail = text.slice(-overlapChars);
  const firstSpace = tail.indexOf(' ');
  return firstSpace > 0 ? tail.slice(firstSpace + 1) : tail;
}

export function chunkText(input: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_CHUNK_OPTIONS.maxChars;
  const overlapChars = Math.min(
    options.overlapChars ?? DEFAULT_CHUNK_OPTIONS.overlapChars,
    Math.max(0, maxChars - 1),
  );

  const text = input.replace(/\r\n/g, '\n').trim();
  if (text.length === 0) return [];

  // Break units that individually exceed maxChars into hard slices first.
  const units: string[] = [];
  for (const unit of splitUnits(text)) {
    if (unit.length <= maxChars) {
      units.push(unit);
    } else {
      for (let i = 0; i < unit.length; i += maxChars) {
        units.push(unit.slice(i, i + maxChars));
      }
    }
  }

  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    const candidate = current ? `${current} ${unit}` : unit;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      const tail = overlapTail(current, overlapChars);
      current = tail ? `${tail} ${unit}` : unit;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((content, index) => ({ index, content }));
}
