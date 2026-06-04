import { randomUUID } from 'node:crypto';
import {
  createKbDocument,
  listKbDocumentsByOrg,
  markKbDocumentFailed,
  type Database,
  type KbDocumentRow,
} from '@graft/db';
import {
  kbDocumentIdSchema,
  kbDocumentSummarySchema,
  kbObjectKey,
  type KbDocumentSummary,
  type ListKbDocumentsResponse,
  type UploadKbDocumentResponse,
} from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { Errors } from '../errors.js';
import type { IngestionQueue } from '../queue/ingestion-queue.js';
import type { Storage } from '../storage/s3.js';
import { detectFileType } from '../upload/file-type.js';

interface KbUploadRouteOptions {
  db: Database;
  storage: Storage;
  queue: IngestionQueue;
}

const MAX_FILENAME_LENGTH = 255;

function isFileTooLargeError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'FST_REQ_FILE_TOO_LARGE'
  );
}

/**
 * Owner-only KB upload ingress. Accepts a single multipart file (PDF/DOCX/text),
 * stages it in object storage, records a PENDING document, enqueues a BullMQ job,
 * and returns immediately (202). Parsing/embedding happens asynchronously in the
 * worker (unit 13). Scope (org) comes from the verified JWT, never the client.
 */
export const kbUploadRoutes: FastifyPluginAsync<KbUploadRouteOptions> = async (app, opts) => {
  const { db, storage, queue } = opts;

  app.post(
    '/kb/documents',
    { preHandler: [app.authenticate, app.requireRole('OWNER')] },
    async (request, reply) => {
      const organizationId = request.authUser!.org;
      const uploadedByAgentId = request.authUser!.sub;

      const data = await request.file();
      if (!data) throw Errors.noFile();

      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        if (isFileTooLargeError(err)) throw Errors.fileTooLarge();
        throw err;
      }

      if (buffer.byteLength === 0) throw Errors.badRequest('The uploaded file is empty.');

      const detected = detectFileType(data.filename, data.mimetype);
      if (!detected) throw Errors.unsupportedFileType();

      const filename = data.filename.trim().slice(0, MAX_FILENAME_LENGTH) || 'document';
      const documentId = kbDocumentIdSchema.parse(randomUUID());
      const objectKey = kbObjectKey(organizationId, documentId);

      await createKbDocument(db, {
        id: documentId,
        organizationId,
        filename,
        fileType: detected.fileType,
        byteSize: buffer.byteLength,
        uploadedByAgentId,
      });

      try {
        await storage.putObject(objectKey, buffer, detected.contentType);
        await queue.enqueue({
          documentId,
          organizationId,
          objectKey,
          fileType: detected.fileType,
        });
      } catch (err) {
        request.log.error({ err, documentId }, 'failed to stage/enqueue document');
        await markKbDocumentFailed(db, documentId, 'Failed to stage or enqueue the document.');
        throw Errors.ingestionFailed();
      }

      const body: UploadKbDocumentResponse = {
        documentId,
        filename,
        fileType: detected.fileType,
        status: 'PENDING',
      };
      return reply.code(202).send(body);
    },
  );

  // Owner's document list with live ingestion status. Org-scoped from the JWT.
  app.get(
    '/kb/documents',
    { preHandler: [app.authenticate, app.requireRole('OWNER')] },
    async (request): Promise<ListKbDocumentsResponse> => {
      const organizationId = request.authUser!.org;
      const rows = await listKbDocumentsByOrg(db, organizationId);
      return { documents: rows.map(toSummary) };
    },
  );
};

/** Projects a DB row to the safe client summary (timestamps → ISO strings). */
function toSummary(row: KbDocumentRow): KbDocumentSummary {
  return kbDocumentSummarySchema.parse({
    id: row.id,
    filename: row.filename,
    fileType: row.fileType,
    status: row.status,
    byteSize: row.byteSize,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
  });
}
