import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { IngestionEnv } from '../env.js';

export interface Storage {
  /** Stores an object's bytes under `key`. */
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Reads an object's full bytes (worker side). */
  getObject(key: string): Promise<Buffer>;
  /** Removes an object; used to clean up staged uploads after processing/failure. */
  deleteObject(key: string): Promise<void>;
  /** Releases the underlying client. */
  close(): void;
}

/**
 * S3-compatible object storage for staging KB uploads (AWS S3 in prod, MinIO in
 * dev — same SDK). The uploaded file is staged here and the ingestion worker
 * (unit 13) reads it back by key, keeping blobs out of Postgres and Redis.
 */
export function createStorage(env: IngestionEnv): Storage {
  const client = new S3Client({
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
  });

  return {
    async putObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.byteLength,
        }),
      );
    },
    async getObject(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      if (!result.Body) throw new Error(`object not found: ${key}`);
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    },
    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    },
    close() {
      client.destroy();
    },
  };
}
