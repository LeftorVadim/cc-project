import "server-only";

export function getAisStreamApiKey(): string | null {
  const value = process.env.AISSTREAM_API_KEY?.trim();
  return value ? value : null;
}
