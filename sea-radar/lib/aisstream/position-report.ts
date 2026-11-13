import type { Vessel } from "@/types/vessel";

const AIS_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{1,9}) ([+-]\d{2})(\d{2}) UTC$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const match = AIS_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText.slice(1));
  const offsetMinute = Number(offsetMinuteText);

  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const milliseconds = fraction.slice(0, 3).padEnd(3, "0");
  const offset = `${offsetHourText}:${offsetMinuteText}`;
  const timestamp = Date.parse(
    `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}.${milliseconds}${offset}`,
  );

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function parseMmsi(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function parseOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Convert one AISStream PositionReport to the application's vessel model. */
export function positionReportToVessel(raw: unknown): Vessel | null {
  if (!isRecord(raw) || raw.MessageType !== "PositionReport") return null;

  const metadata = raw.MetaData;
  const message = raw.Message;
  if (!isRecord(metadata) || !isRecord(message)) return null;

  const positionReport = message.PositionReport;
  if (!isRecord(positionReport)) return null;

  const id = parseMmsi(metadata.MMSI);
  const timestamp = parseTimestamp(metadata.time_utc);
  const lat = parseOptionalNumber(positionReport.Latitude);
  const lon = parseOptionalNumber(positionReport.Longitude);

  if (
    id === null ||
    timestamp === null ||
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  const rawName = metadata.ShipName;
  const trimmedName = typeof rawName === "string" ? rawName.trim() : "";
  const rawSpeed = parseOptionalNumber(positionReport.Sog);
  const rawCourse = parseOptionalNumber(positionReport.Cog);

  return {
    id,
    name: trimmedName.length > 0 ? trimmedName : null,
    lat,
    lon,
    speedKnots:
      rawSpeed !== null && rawSpeed >= 0 && rawSpeed <= 102.2 ? rawSpeed : null,
    courseDeg:
      rawCourse !== null && rawCourse >= 0 && rawCourse < 360 ? rawCourse : null,
    timestamp,
    source: "aisstream",
  };
}
