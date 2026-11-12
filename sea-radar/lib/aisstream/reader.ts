import "server-only";

import { REGION } from "@/config/map";

export const AISSTREAM_WINDOW_MS = 15_000;
const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";

export type SnapshotErrorCode =
  | "connect_failed"
  | "provider_error"
  | "disconnected"
  | "internal"
  | "cancelled";

export class SnapshotReaderError extends Error {
  constructor(readonly code: SnapshotErrorCode) {
    super(code);
    this.name = "SnapshotReaderError";
  }
}

export type ReaderOptions = {
  apiKey: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  createSocket?: (url: string) => WebSocket;
};

function getSocketState(socket: WebSocket): number {
  return socket.readyState;
}

export function readFirstMessage({
  apiKey,
  signal,
  timeoutMs = AISSTREAM_WINDOW_MS,
  createSocket = (url) => new WebSocket(url),
}: ReaderOptions): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    let socket: WebSocket;
    let settled = false;
    let opened = false;
    let subscribed = false;

    const timer = setTimeout(() => {
      finish(
        subscribed ? null : undefined,
        subscribed ? undefined : new SnapshotReaderError("connect_failed"),
      );
    }, timeoutMs);

    const onAbort = () => finish(undefined, new SnapshotReaderError("cancelled"));

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (socket) {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
        if (
          getSocketState(socket) === WebSocket.CONNECTING ||
          getSocketState(socket) === WebSocket.OPEN
        ) {
          try {
            socket.close();
          } catch {
            // Cleanup must not replace the original result.
          }
        }
      }
    };

    const finish = (value?: unknown, error?: SnapshotReaderError) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value ?? null);
    };

    const onOpen = () => {
      opened = true;
      try {
        const { southWest, northEast } = REGION;
        socket.send(
          JSON.stringify({
            APIKey: apiKey,
            BoundingBoxes: [
              [
                [southWest.lat, southWest.lon],
                [northEast.lat, northEast.lon],
              ],
            ],
            FilterMessageTypes: ["PositionReport"],
          }),
        );
        subscribed = true;
      } catch {
        finish(undefined, new SnapshotReaderError("connect_failed"));
      }
    };

    const onMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        let text: string;
        if (typeof data === "string") {
          text = data;
        } else if (data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(data);
        } else if (ArrayBuffer.isView(data)) {
          text = new TextDecoder().decode(data);
        } else {
          finish(undefined, new SnapshotReaderError("provider_error"));
          return;
        }

        const raw: unknown = JSON.parse(text);
        if (
          typeof raw === "object" &&
          raw !== null &&
          "error" in raw
        ) {
          finish(undefined, new SnapshotReaderError("provider_error"));
          return;
        }
        finish(raw);
      } catch {
        finish(undefined, new SnapshotReaderError("provider_error"));
      }
    };

    const onError = () => {
      finish(
        undefined,
        new SnapshotReaderError(opened ? "provider_error" : "connect_failed"),
      );
    };

    const onClose = () => {
      finish(
        undefined,
        new SnapshotReaderError(subscribed ? "disconnected" : "connect_failed"),
      );
    };

    if (signal?.aborted) {
      finish(undefined, new SnapshotReaderError("cancelled"));
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      socket = createSocket(AISSTREAM_URL);
      socket.addEventListener("open", onOpen);
      socket.addEventListener("message", onMessage);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    } catch {
      finish(undefined, new SnapshotReaderError("connect_failed"));
    }
  });
}
