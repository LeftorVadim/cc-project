import { getAisStreamApiKey } from "@/lib/aisstream/api-key";
import {
  readFirstMessage,
  SnapshotReaderError,
} from "@/lib/aisstream/reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR_MESSAGES = {
  no_api_key: "Ключ AISStream не настроен",
  connect_failed: "Не удалось подключиться к источнику",
  provider_error: "Источник вернул ошибку",
  disconnected: "Соединение с источником разорвано",
  internal: "Внутренняя ошибка сервера",
} as const;

type ApiErrorCode = keyof typeof ERROR_MESSAGES;

function errorResponse(code: ApiErrorCode, attemptedAt: string): Response {
  return Response.json(
    {
      ok: false,
      attemptedAt,
      error: { code, message: ERROR_MESSAGES[code] },
    },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const attemptedAt = new Date().toISOString();
  const apiKey = getAisStreamApiKey();

  if (!apiKey) return errorResponse("no_api_key", attemptedAt);

  try {
    const raw = await readFirstMessage({ apiKey, signal: request.signal });
    if (request.signal.aborted) return new Response(null, { status: 499 });

    return Response.json(
      { ok: true, raw, collectedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (
      request.signal.aborted ||
      (error instanceof SnapshotReaderError && error.code === "cancelled")
    ) {
      return new Response(null, { status: 499 });
    }

    const code: ApiErrorCode =
      error instanceof SnapshotReaderError &&
      error.code !== "cancelled" &&
      error.code in ERROR_MESSAGES
        ? error.code
        : "internal";
    return errorResponse(code, attemptedAt);
  }
}
