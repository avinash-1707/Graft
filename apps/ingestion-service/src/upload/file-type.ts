import type { KbDocumentType } from '@graft/shared';

interface DetectedType {
  fileType: KbDocumentType;
  /** Canonical content type stored on the object (not the client-claimed one). */
  contentType: string;
}

const MIME_MAP: Record<string, DetectedType> = {
  'application/pdf': { fileType: 'PDF', contentType: 'application/pdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    fileType: 'DOCX',
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  'text/plain': { fileType: 'TEXT', contentType: 'text/plain' },
  'text/markdown': { fileType: 'TEXT', contentType: 'text/plain' },
};

const EXT_MAP: Record<string, DetectedType> = {
  pdf: MIME_MAP['application/pdf']!,
  docx: MIME_MAP['application/vnd.openxmlformats-officedocument.wordprocessingml.document']!,
  txt: MIME_MAP['text/plain']!,
  md: MIME_MAP['text/plain']!,
};

/**
 * Resolves a supported KB document type from the declared MIME type, falling back
 * to the filename extension (clients often send `application/octet-stream`).
 * Returns undefined for unsupported types. Note: this is a declared-type check,
 * not magic-byte sniffing — the worker (unit 13) validates real content on parse.
 */
export function detectFileType(filename: string, mimetype: string): DetectedType | undefined {
  const byMime = MIME_MAP[mimetype.toLowerCase()];
  if (byMime) return byMime;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? EXT_MAP[ext] : undefined;
}
