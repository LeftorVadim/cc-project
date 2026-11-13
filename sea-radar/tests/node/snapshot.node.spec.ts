import { expect, test } from "@playwright/test";
import type { Vessel } from "../../types/vessel";
import { collectSnapshot } from "../../lib/aisstream/snapshot";

type Listener = (event: Event) => void;

class FakeSocket {
  readyState: number = WebSocket.CONNECTING;
  closeCalls = 0;
  sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    const wrapped: Listener = typeof listener === "function"
      ? listener as Listener
      : (event) => listener.handleEvent(event);
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(wrapped);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    const set = this.listeners.get(type);
    if (!set) return;
    for (const registered of set) {
      if (registered === listener || (typeof listener === "object" && registered.toString() === listener.handleEvent.toString())) {
        set.delete(registered);
      }
    }
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = WebSocket.CLOSED;
  }

  emit(type: string, event: Event = new Event(type)): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  open(): void {
    this.readyState = WebSocket.OPEN;
    this.emit("open");
  }

  report(vessel: Vessel): void {
    this.emit("message", new MessageEvent("message", { data: JSON.stringify(toPositionReport(vessel)) }));
  }

  raw(data: unknown): void {
    this.emit("message", new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  providerError(): void {
    this.raw({ error: "synthetic provider failure" });
  }

  disconnect(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }

  failSocket(): void {
    this.emit("error");
  }

  get listenerCount(): number {
    return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0);
  }
}

class FakeClock {
  nowMs = Date.parse("2026-01-01T12:00:00.000Z");
  private nextId = 1;
  private readonly timers = new Map<number, () => void>();

  now = (): number => this.nowMs;

  setTimer = (callback: () => void, _delayMs: number): ReturnType<typeof setTimeout> => {
    const id = this.nextId++;
    this.timers.set(id, callback);
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  clearTimer = (timer: ReturnType<typeof setTimeout>): void => {
    this.timers.delete(timer as unknown as number);
  };

  fire(): void {
    const active = [...this.timers.entries()];
    this.timers.clear();
    for (const [, callback] of active) callback();
  }

  get pendingTimers(): number {
    return this.timers.size;
  }
}

function makeVessel(
  id: string,
  lat: number,
  lon: number,
  timestamp: string,
  name: string | null = `VESSEL ${id}`,
): Vessel {
  return {
    id,
    name,
    lat,
    lon,
    speedKnots: 12.4,
    courseDeg: 274.6,
    timestamp,
    source: "aisstream",
  };
}

function toPositionReport(vessel: Vessel): unknown {
  const [wholeSeconds, fractional = "000"] = vessel.timestamp.split(".");
  return {
    MessageType: "PositionReport",
    MetaData: {
      MMSI: vessel.id,
      ShipName: vessel.name,
      time_utc: `${wholeSeconds.replace("T", " ")}.${
        fractional.replace("Z", "").padEnd(9, "0")
      } +0000 UTC`,
    },
    Message: {
      PositionReport: {
        Latitude: vessel.lat,
        Longitude: vessel.lon,
        Sog: vessel.speedKnots,
        Cog: vessel.courseDeg,
      },
    },
  };
}

function setup(options: { timeoutMs?: number; limit?: number } = {}) {
  const clock = new FakeClock();
  const socket = new FakeSocket();
  const controller = new AbortController();
  const result = collectSnapshot({
    apiKey: "test-key",
    signal: controller.signal,
    timeoutMs: options.timeoutMs ?? 15_000,
    limit: options.limit ?? 100,
    now: clock.now,
    createSocket: () => socket as unknown as WebSocket,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return { clock, socket, controller, result };
}

function expectedSnapshot(
  vessels: Vessel[],
  collectedAt: string,
  count: number,
  truncated: boolean,
  reason: "window_elapsed" | "limit_reached",
) {
  return { vessels, collectedAt, windowSeconds: 15, count, truncated, reason };
}

async function expectFailure(
  result: Promise<unknown>,
  code: "connect_failed" | "provider_error" | "disconnected" | "cancelled",
): Promise<void> {
  await expect(result).rejects.toMatchObject({ name: "SnapshotReaderError", code });
}

test("duplicate messages for one MMSI produce one vessel", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  const vessel = makeVessel("111000001", 50.95, 1.42, "2026-01-01T12:00:00.000Z");
  socket.report(vessel);
  socket.report(vessel);
  clock.nowMs = Date.parse("2026-01-01T12:00:15.000Z");
  clock.fire();

  await expect(result).resolves.toEqual(expectedSnapshot([vessel], "2026-01-01T12:00:15.000Z", 1, false, "window_elapsed"));
  expect(socket.closeCalls).toBe(1);
  expect(clock.pendingTimers).toBe(0);
});

test("latest timestamp wins even when the older position arrives later", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  const latest = makeVessel("111000002", 51.1, 1.6, "2026-01-01T12:01:00.000Z");
  const older = makeVessel("111000002", 50.95, 1.42, "2026-01-01T12:00:00.000Z");
  socket.report(latest);
  socket.report(older);
  clock.fire();

  await expect(result).resolves.toEqual(expectedSnapshot([latest], "2026-01-01T12:00:00.000Z", 1, false, "window_elapsed"));
});

test("equal timestamps keep the first accepted position", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  const first = makeVessel("111000003", 50.95, 1.42, "2026-01-01T12:00:00.000Z");
  const second = makeVessel("111000003", 51.1, 1.6, "2026-01-01T12:00:00.000Z");
  socket.report(first);
  socket.report(second);
  clock.fire();

  await expect(result).resolves.toEqual(expectedSnapshot([first], "2026-01-01T12:00:00.000Z", 1, false, "window_elapsed"));
});

test("the 100th unique vessel ends collection and the 101st is not accepted", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  const vessels = Array.from({ length: 100 }, (_, index) =>
    makeVessel(String(200_000_000 + index), 50 + index / 100, 1 + index / 100, "2026-01-01T12:00:00.000Z"),
  );
  for (const vessel of vessels) socket.report(vessel);
  socket.report(makeVessel("300000001", 51, 2, "2026-01-01T12:00:00.000Z"));

  await expect(result).resolves.toEqual(expectedSnapshot(vessels, "2026-01-01T12:00:00.000Z", 100, true, "limit_reached"));
  expect(clock.pendingTimers).toBe(0);
  expect(socket.closeCalls).toBe(1);
});

test("100 messages for one vessel do not hit the unique-vessel limit", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  const vessel = makeVessel("111000004", 50.95, 1.42, "2026-01-01T12:00:00.000Z");
  for (let index = 0; index < 100; index += 1) socket.report(vessel);
  expect(clock.pendingTimers).toBe(1);
  clock.nowMs = Date.parse("2026-01-01T12:00:15.000Z");
  clock.fire();

  await expect(result).resolves.toEqual(expectedSnapshot([vessel], "2026-01-01T12:00:15.000Z", 1, false, "window_elapsed"));
});

test("a live empty connection succeeds when the collection window elapses", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  clock.nowMs = Date.parse("2026-01-01T12:00:15.000Z");
  clock.fire();

  await expect(result).resolves.toEqual(expectedSnapshot([], "2026-01-01T12:00:15.000Z", 0, false, "window_elapsed"));
  expect(socket.closeCalls).toBe(1);
  expect(socket.listenerCount).toBe(0);
  expect(clock.pendingTimers).toBe(0);
});

test("a connection that never opens fails at the deadline", async () => {
  const { clock, socket, result } = setup();
  clock.fire();

  await expectFailure(result, "connect_failed");
  expect(socket.closeCalls).toBe(1);
  expect(socket.listenerCount).toBe(0);
  expect(clock.pendingTimers).toBe(0);
});

test("a socket error before open fails immediately", async () => {
  const { clock, socket, result } = setup();
  socket.failSocket();

  await expectFailure(result, "connect_failed");
  expect(socket.closeCalls).toBe(1);
  expect(socket.listenerCount).toBe(0);
  expect(clock.pendingTimers).toBe(0);
});

test("provider failure after valid messages rejects without returning a partial snapshot", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  for (let index = 0; index < 3; index += 1) {
    socket.report(makeVessel(String(400_000_000 + index), 50.1 + index / 10, 1.1 + index / 10, "2026-01-01T12:00:00.000Z"));
  }
  socket.providerError();

  await expectFailure(result, "provider_error");
  expect(socket.closeCalls).toBe(1);
  expect(socket.listenerCount).toBe(0);
  expect(clock.pendingTimers).toBe(0);
});

test("disconnect after valid messages rejects without returning a partial snapshot", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  for (let index = 0; index < 3; index += 1) {
    socket.report(makeVessel(String(500_000_000 + index), 50.1 + index / 10, 1.1 + index / 10, "2026-01-01T12:00:00.000Z"));
  }
  socket.disconnect();

  await expectFailure(result, "disconnected");
  expect(socket.closeCalls).toBe(0);
  expect(socket.listenerCount).toBe(0);
  expect(clock.pendingTimers).toBe(0);
});

test("a provider error after limit completion does not replace or settle the result twice", async () => {
  const { clock, socket, result } = setup({ limit: 1 });
  socket.open();
  const vessel = makeVessel("111000005", 50.95, 1.42, "2026-01-01T12:00:00.000Z");
  socket.report(vessel);
  socket.providerError();

  await expect(result).resolves.toEqual(expectedSnapshot([vessel], "2026-01-01T12:00:00.000Z", 1, true, "limit_reached"));
  expect(socket.closeCalls).toBe(1);
  expect(clock.pendingTimers).toBe(0);
});

test("abort rejects as cancelled and cleans up socket listeners and timer", async () => {
  const { clock, socket, controller, result } = setup();
  socket.open();
  controller.abort();

  await expectFailure(result, "cancelled");
  expect(socket.closeCalls).toBe(1);
  expect(socket.listenerCount).toBe(0);
  expect(clock.pendingTimers).toBe(0);
});

test("a newer message replaces the entire vessel object including a null name", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  socket.report(makeVessel("111000006", 50.95, 1.42, "2026-01-01T12:00:00.000Z", "OLD NAME"));
  const latest = makeVessel("111000006", 51.25, 1.75, "2026-01-01T12:01:00.000Z", null);
  socket.report(latest);
  clock.fire();

  await expect(result).resolves.toEqual(expectedSnapshot([latest], "2026-01-01T12:00:00.000Z", 1, false, "window_elapsed"));
});

test("collectedAt uses the injected clock at completion", async () => {
  const { clock, socket, result } = setup();
  socket.open();
  clock.nowMs = Date.parse("2026-01-01T12:03:04.567Z");
  clock.fire();

  await expect(result).resolves.toEqual({
    vessels: [],
    collectedAt: "2026-01-01T12:03:04.567Z",
    windowSeconds: 15,
    count: 0,
    truncated: false,
    reason: "window_elapsed",
  });
});

test("every completed outcome removes listeners and pending timers", async () => {
  const completedByWindow = setup();
  completedByWindow.socket.open();
  completedByWindow.clock.fire();
  await completedByWindow.result;
  expect(completedByWindow.socket.listenerCount).toBe(0);
  expect(completedByWindow.clock.pendingTimers).toBe(0);

  const completedByLimit = setup({ limit: 1 });
  completedByLimit.socket.open();
  completedByLimit.socket.report(makeVessel("111000007", 50.95, 1.42, "2026-01-01T12:00:00.000Z"));
  await completedByLimit.result;
  expect(completedByLimit.socket.listenerCount).toBe(0);
  expect(completedByLimit.clock.pendingTimers).toBe(0);

  const failed = setup();
  failed.socket.open();
  failed.socket.providerError();
  await expectFailure(failed.result, "provider_error");
  expect(failed.socket.listenerCount).toBe(0);
  expect(failed.clock.pendingTimers).toBe(0);
});
