/**
 * Domain error carrying a stable machine code + HTTP status; the message is safe
 * to return to clients. Flows through the global error handler in {@link buildApp}.
 */
export class ServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const Errors = {
  unauthorized: () => new ServiceError('UNAUTHORIZED', 401, 'Authentication required.'),
  forbidden: () => new ServiceError('FORBIDDEN', 403, 'You do not have access to this resource.'),
  badRequest: (message: string) => new ServiceError('BAD_REQUEST', 400, message),
  unsupportedFileType: () =>
    new ServiceError('UNSUPPORTED_FILE_TYPE', 415, 'Only PDF, DOCX, and text files are supported.'),
  fileTooLarge: () => new ServiceError('FILE_TOO_LARGE', 413, 'The uploaded file is too large.'),
  noFile: () => new ServiceError('NO_FILE', 400, 'A file upload is required.'),
  ingestionFailed: () =>
    new ServiceError('INGESTION_FAILED', 500, 'Failed to accept the document for processing.'),
} as const;
