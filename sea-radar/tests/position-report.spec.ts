import { expect, test } from "@playwright/test";
import sample from "../data/samples/position-report.sample.json";
import { positionReportToVessel } from "../lib/aisstream/position-report";

const sampleVessel = positionReportToVessel(sample);

test("converts the saved PositionReport sample to the vessel model", () => {
  expect(sampleVessel).toEqual({
    id: "123456789",
    name: "TRAINING VESSEL",
    lat: 50.95,
    lon: 1.42,
    speedKnots: 12.4,
    courseDeg: 274.6,
    timestamp: "2026-11-12T12:00:00.123Z",
    source: "aisstream",
  });
});

test("rejects positions with unavailable or out-of-range coordinates", () => {
  for (const [field, value] of [
    ["Latitude", 91],
    ["Latitude", -91],
    ["Longitude", 181],
    ["Longitude", -181],
    ["Latitude", "50.95"],
    ["Longitude", Number.NaN],
  ] as const) {
    const raw = structuredClone(sample);
    raw.Message.PositionReport[field] = value as number;
    expect(positionReportToVessel(raw), `${field}=${String(value)}`).toBeNull();
  }
});

test("accepts coordinate boundaries and keeps zero-valued motion data", () => {
  const raw = structuredClone(sample);
  raw.Message.PositionReport.Latitude = -90;
  raw.Message.PositionReport.Longitude = 180;
  raw.Message.PositionReport.Sog = 0;
  raw.Message.PositionReport.Cog = 0;

  const vessel = positionReportToVessel(raw);
  expect(vessel).not.toBeNull();
  expect(vessel).toMatchObject({ lat: -90, lon: 180, speedKnots: 0, courseDeg: 0 });
});

test("keeps the position but marks unavailable speed and course as null", () => {
  const raw = structuredClone(sample);
  raw.Message.PositionReport.Sog = 102.3;
  raw.Message.PositionReport.Cog = 360;

  expect(positionReportToVessel(raw)).toMatchObject({
    lat: 50.95,
    lon: 1.42,
    speedKnots: null,
    courseDeg: null,
  });
});

test("rejects empty MMSI and unparseable timestamps", () => {
  const emptyMmsi = structuredClone(sample);
  (emptyMmsi.MetaData as { MMSI: unknown }).MMSI = "   ";
  expect(positionReportToVessel(emptyMmsi)).toBeNull();

  const invalidTimestamp = structuredClone(sample);
  invalidTimestamp.MetaData.time_utc = "2026-02-30 12:00:00.123456789 +0000 UTC";
  expect(positionReportToVessel(invalidTimestamp)).toBeNull();
});

test("trims ship names and converts an empty name to null", () => {
  const raw = structuredClone(sample);
  raw.MetaData.ShipName = "   ";
  expect(positionReportToVessel(raw)?.name).toBeNull();

  raw.MetaData.ShipName = "  SEA TRAINER  ";
  expect(positionReportToVessel(raw)?.name).toBe("SEA TRAINER");
});
