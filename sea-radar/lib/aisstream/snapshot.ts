import "server-only";

import type { Vessel } from "@/types/vessel";
import { REGION } from "@/config/map";
import {
  AISSTREAM_MAX_VESSELS,
  AISSTREAM_WINDOW_MS,
} from "@/lib/aisstream/config";
import {
  SnapshotReaderError,
  type SnapshotErrorCode,
} from "@/lib/aisstream/reader";
import { positionReportToVessel } from "@/lib/aisstream/position-report";

export type SnapshotReason = "window_elapsed" | "limit_reached";

export type SnapshotResult = {
  vessels: Vessel[];
  collectedAt: string;
  windowSeconds: number;
  count: number;
  truncated: boolean;
  reason: SnapshotReason;
};

type SnapshotSocket = WebSocket;
type TimerHandle = ReturnType<typeof setTimeout>;

export type CollectSnapshotOptions = {
  apiKey: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  limit?: number;
  now?: () => number;
  createSocket?: (url: string) => SnapshotSocket;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (timer: TimerHandle) => void;
};

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";

function parseProviderMessage(data: unknown): unknown {
  let text: string;
  if (typeof data === "string") {
    text = data;
  } else if (data instanceof ArrayBuffer) {
    text = new TextDecoder().decode(data);
  } else if (ArrayBuffer.isView(data)) {
    text = new TextDecoder().decode(data);
  } else {
    throw new SnapshotReaderError("provider_error");
  }

  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw === "object" && raw !== null && "error" in raw) {
      throw new SnapshotReaderError("provider_error");
    }
    return raw;
  } catch (error) {
    if (error instanceof SnapshotReaderError) throw error;
    throw new SnapshotReaderError("provider_error");
  }
}

function getTimestampMs(vessel: Vessel): number {
  return Date.parse(vessel.timestamp);
}

export function collectSnapshot({
  apiKey,
  signal,
  timeoutMs = AISSTREAM_WINDOW_MS,
  limit = AISSTREAM_MAX_VESSELS,
  now = Date.now,
  createSocket = (url) => new WebSocket(url),
  setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer = (timer) => clearTimeout(timer),
}: CollectSnapshotOptions): Promise<SnapshotResult> {
  return new Promise((resolve, reject) => {
    let socket: SnapshotSocket;
    let settled = false;
    let opened = false;
    let subscribed = false;
    const vesselsById = new Map<string, Vessel>();

    const cleanup = () => {
      clearTimer(timer);
      signal?.removeEventListener("abort", onAbort);
      if (socket) {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
          try {
            socket.close();
          } catch {
            // Preserve the result that caused cleanup.
          }
        }
      }
    };

    const finish = (reason: SnapshotReason) => {
      if (settled) return;
      settled = true;
      const vessels = [...vesselsById.values()];
      const collectedAt = new Date(now()).toISOString();
      cleanup();
      resolve({
        vessels,
        collectedAt,
        windowSeconds: AISSTREAM_WINDOW_MS / 1000,
        count: vessels.length,
        truncated: reason === "limit_reached",
        reason,
      });
    };

    const fail = (code: SnapshotErrorCode) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new SnapshotReaderError(code));
    };

    const onAbort = () => fail("cancelled");

    const timer = setTimer(() => {
      if (!subscribed) fail("connect_failed");
      else finish("window_elapsed");
    }, timeoutMs);

    const onOpen = () => {
      opened = true;
      try {
        const { southWest, northEast } = REGION;
        socket.send(JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [[[southWest.lat, southWest.lon], [northEast.lat, northEast.lon]]],
          FilterMessageTypes: ["PositionReport"],
        }));
        subscribed = true;
      } catch {
        fail("connect_failed");
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (!subscribed) return;
      let raw: unknown;
      try {
        raw = parseProviderMessage(event.data);
      } catch {
        fail("provider_error");
        return;
      }

      const vessel = positionReportToVessel(raw);
      if (!vessel) return;
      const existing = vesselsById.get(vessel.id);
      if (existing && getTimestampMs(vessel) <= getTimestampMs(existing)) return;

      vesselsById.set(vessel.id, vessel);
      if (vesselsById.size >= limit) finish("limit_reached");
    };

    const onError = () => fail(opened ? "provider_error" : "connect_failed");
    const onClose = () => fail(subscribed ? "disconnected" : "connect_failed");

    if (signal?.aborted) {
      fail("cancelled");
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
      fail("connect_failed");
    }

  });
}
