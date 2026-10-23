import { declaredBodyLength, fail } from './http.js';

// Ephemeral per-isolate admission accounting, not request data or a durable quota.
// Leave headroom for the runtime, JSON handlers, hashing and provider transport.
const CAPACITY = 64 * 1024 * 1024;
let reserved = 0;

export async function withUploadBuffer(request, limit, operation) {
  const size = declaredBodyLength(request, limit) ?? limit;
  if (reserved + size > CAPACITY) {
    void request.body?.cancel().catch(() => {});
    fail(503, 'upload_busy', 'Uploads are busy. Try again shortly.', {}, {'retry-after':'5'});
  }
  reserved += size;
  try { return await operation(); }
  finally { reserved -= size; }
}
