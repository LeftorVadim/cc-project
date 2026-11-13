import { expect, test } from "@playwright/test";
import sample from "../../data/samples/position-report.sample.json";
import { positionReportToVessel } from "../../lib/aisstream/position-report";

const EXPECTED_SAMPLE_VESSEL = {
  id: "123456789",
  name: "TRAINING VESSEL",
  lat: 50.95,
  lon: 1.42,
  speedKnots: 12.4,
  courseDeg: 274.6,
  timestamp: "2026-11-12T12:00:00.123Z",
  source: "aisstream",
};

test("saved PositionReport sample converts to the expected vessel literal", () => {
  expect(positionReportToVessel(sample)).toEqual(EXPECTED_SAMPLE_VESSEL);
});

test("synthetic variants with a missing or whitespace-only name retain null name", () => {
  const missingName = structuredClone(sample);
  delete (missingName.MetaData as { ShipName?: string }).ShipName;

  const whitespaceName = structuredClone(sample);
  whitespaceName.MetaData.ShipName = "   ";

  expect(positionReportToVessel(missingName)).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    name: null,
  });
  expect(positionReportToVessel(whitespaceName)).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    name: null,
  });
});

test("synthetic speed variants preserve zero and map invalid or missing speed to null", () => {
  const zeroSpeed = structuredClone(sample);
  zeroSpeed.Message.PositionReport.Sog = 0;

  const excessiveSpeed = structuredClone(sample);
  excessiveSpeed.Message.PositionReport.Sog = 102.3;

  const negativeSpeed = structuredClone(sample);
  negativeSpeed.Message.PositionReport.Sog = -1;

  const missingSpeed = structuredClone(sample);
  delete (missingSpeed.Message.PositionReport as { Sog?: number }).Sog;

  expect(positionReportToVessel(zeroSpeed)).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: 0,
  });
  expect(positionReportToVessel(excessiveSpeed)).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: null,
  });
  expect(positionReportToVessel(negativeSpeed)).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: null,
  });
  expect(positionReportToVessel(missingSpeed)).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: null,
  });
});

test("synthetic course 360 maps to null", () => {
  const raw = structuredClone(sample);
  raw.Message.PositionReport.Cog = 360;

  expect(positionReportToVessel(raw)).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    courseDeg: null,
  });
});

test("synthetic invalid coordinates are discarded instead of producing a zero position", () => {
  const cases = [
    { name: "91/181", latitude: 91, longitude: 181 },
    { name: "95/-200", latitude: 95, longitude: -200 },
  ] as const;

  for (const scenario of cases) {
    const raw = structuredClone(sample);
    raw.Message.PositionReport.Latitude = scenario.latitude;
    raw.Message.PositionReport.Longitude = scenario.longitude;

    const vessel = positionReportToVessel(raw);
    // Null proves the invalid position is discarded, not defaulted to (0, 0).
    expect(vessel, `synthetic coordinates ${scenario.name}`).toBeNull();
  }
});

test("synthetic string coordinate is discarded", () => {
  const raw = structuredClone(sample);
  (raw.Message.PositionReport as { Latitude: number | string }).Latitude = "50.95";

  expect(positionReportToVessel(raw)).toBeNull();
});

test("synthetic missing and empty MMSI values discard the position", () => {
  const missingMmsi = structuredClone(sample);
  delete (missingMmsi.MetaData as { MMSI?: number }).MMSI;

  const emptyMmsi = structuredClone(sample);
  (emptyMmsi.MetaData as { MMSI: unknown }).MMSI = "";

  expect(positionReportToVessel(missingMmsi)).toBeNull();
  expect(positionReportToVessel(emptyMmsi)).toBeNull();
});

test("synthetic unparseable timestamp discards the position", () => {
  const raw = structuredClone(sample);
  raw.MetaData.time_utc = "not-a-timestamp";

  expect(positionReportToVessel(raw)).toBeNull();
});
