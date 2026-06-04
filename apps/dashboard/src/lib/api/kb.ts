import type { ListKbDocumentsResponse, UploadKbDocumentResponse } from "@graft/shared";

import { INGESTION_URL } from "@/lib/env";
import { apiFetch } from "./http";

/**
 * Knowledge-base endpoints on the ingestion-service (units 12/13), which runs on its
 * own host/port — not the gateway. Calls carry the same minted JWT (verified via
 * JWKS) and target `INGESTION_URL`.
 */
export const kbApi = {
  list: () =>
    apiFetch<ListKbDocumentsResponse>("/kb/documents", { baseUrl: INGESTION_URL }),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<UploadKbDocumentResponse>("/kb/documents", {
      method: "POST",
      baseUrl: INGESTION_URL,
      formData,
    });
  },
};
