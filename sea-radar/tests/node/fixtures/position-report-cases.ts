import sample from "../../../data/samples/position-report.sample.json";

function fromSample() {
  return structuredClone(sample);
}

export const positionReportCases = {
  valid: fromSample,
  missingName: () => {
    const raw = fromSample();
    delete (raw.MetaData as { ShipName?: string }).ShipName;
    return raw;
  },
  whitespaceName: () => {
    const raw = fromSample();
    raw.MetaData.ShipName = "   ";
    return raw;
  },
  zeroSpeed: () => {
    const raw = fromSample();
    raw.Message.PositionReport.Sog = 0;
    return raw;
  },
  excessiveSpeed: () => {
    const raw = fromSample();
    raw.Message.PositionReport.Sog = 102.3;
    return raw;
  },
  negativeSpeed: () => {
    const raw = fromSample();
    raw.Message.PositionReport.Sog = -1;
    return raw;
  },
  missingSpeed: () => {
    const raw = fromSample();
    delete (raw.Message.PositionReport as { Sog?: number }).Sog;
    return raw;
  },
  course360: () => {
    const raw = fromSample();
    raw.Message.PositionReport.Cog = 360;
    return raw;
  },
  unavailableCoordinates: () => {
    const raw = fromSample();
    raw.Message.PositionReport.Latitude = 91;
    raw.Message.PositionReport.Longitude = 181;
    return raw;
  },
  outOfRangeCoordinates: () => {
    const raw = fromSample();
    raw.Message.PositionReport.Latitude = 95;
    raw.Message.PositionReport.Longitude = -200;
    return raw;
  },
  stringLatitude: () => {
    const raw = fromSample();
    (raw.Message.PositionReport as { Latitude: number | string }).Latitude = "50.95";
    return raw;
  },
  missingMmsi: () => {
    const raw = fromSample();
    delete (raw.MetaData as { MMSI?: number }).MMSI;
    return raw;
  },
  emptyMmsi: () => {
    const raw = fromSample();
    (raw.MetaData as { MMSI: unknown }).MMSI = "";
    return raw;
  },
  invalidTimestamp: () => {
    const raw = fromSample();
    raw.MetaData.time_utc = "not-a-timestamp";
    return raw;
  },
} as const;
