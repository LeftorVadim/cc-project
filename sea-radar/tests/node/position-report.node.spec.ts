import { expect, test } from "@playwright/test";
import { positionReportToVessel } from "../../lib/aisstream/position-report";
import { positionReportCases } from "./fixtures/position-report-cases";

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
  expect(positionReportToVessel(positionReportCases.valid())).toEqual(EXPECTED_SAMPLE_VESSEL);
});

test("synthetic variants with a missing or whitespace-only name retain null name", () => {
  expect(positionReportToVessel(positionReportCases.missingName())).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    name: null,
  });
  expect(positionReportToVessel(positionReportCases.whitespaceName())).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    name: null,
  });
});

test("synthetic speed variants preserve zero and map invalid or missing speed to null", () => {
  expect(positionReportToVessel(positionReportCases.zeroSpeed())).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: 0,
  });
  expect(positionReportToVessel(positionReportCases.excessiveSpeed())).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: null,
  });
  expect(positionReportToVessel(positionReportCases.negativeSpeed())).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: null,
  });
  expect(positionReportToVessel(positionReportCases.missingSpeed())).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    speedKnots: null,
  });
});

test("synthetic course 360 maps to null", () => {
  expect(positionReportToVessel(positionReportCases.course360())).toEqual({
    ...EXPECTED_SAMPLE_VESSEL,
    courseDeg: null,
  });
});

test("synthetic invalid coordinates are discarded instead of producing a zero position", () => {
  const cases = [
    { name: "91/181", raw: positionReportCases.unavailableCoordinates() },
    { name: "95/-200", raw: positionReportCases.outOfRangeCoordinates() },
  ] as const;

  for (const scenario of cases) {
    expect(
      positionReportToVessel(scenario.raw),
      `synthetic coordinates ${scenario.name}`,
    ).toBeNull();
  }
});

test("synthetic string coordinate is discarded", () => {
  expect(positionReportToVessel(positionReportCases.stringLatitude())).toBeNull();
});

test("synthetic missing and empty MMSI values discard the position", () => {
  expect(positionReportToVessel(positionReportCases.missingMmsi())).toBeNull();
  expect(positionReportToVessel(positionReportCases.emptyMmsi())).toBeNull();
});

test("synthetic unparseable timestamp discards the position", () => {
  expect(positionReportToVessel(positionReportCases.invalidTimestamp())).toBeNull();
});
