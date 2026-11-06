
export type RequestBodyResult =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      reason: "too_large" | "read_error";
    };

export async function readRequestBody(
  request: Request,
  maxBytes: number,
): Promise<RequestBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("Invalid request body size limit.");
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return {
      ok: true,
      text: "",
    };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Cancellation failure must not change the size-limit result.
        }

        return {
          ok: false,
          reason: "too_large",
        };
      }

      chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      ok: true,
      text: new TextDecoder().decode(body),
    };
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The stream may already be closed, errored, or cancelled.
    }

    return {
      ok: false,
      reason: "read_error",
    };
  } finally {
    reader.releaseLock();
  }
}
