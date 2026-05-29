import type { KbDocumentType } from '@graft/shared';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Extracts plain text from a staged document by type. PDF via unpdf (pdfjs under
 * the hood, ESM-friendly), DOCX via mammoth (raw text), text decoded as UTF-8.
 * Throws if the bytes don't parse — the worker turns that into a FAILED document.
 */
export async function parseDocument(fileType: KbDocumentType, bytes: Buffer): Promise<string> {
  switch (fileType) {
    case 'PDF': {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: true });
      return text.trim();
    }
    case 'DOCX': {
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      return value.trim();
    }
    case 'TEXT':
      return bytes.toString('utf8').trim();
  }
}
