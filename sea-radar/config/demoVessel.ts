import { INITIAL_VIEW } from "@/config/map";
import type { Vessel } from "@/types/vessel";

export const DEMO_VESSEL: Vessel = {
  id: "demo-1",
  name: "Демо-судно 1",
  lat: INITIAL_VIEW.center.lat,
  lon: INITIAL_VIEW.center.lon,
  speedKnots: null,
  courseDeg: 15,
  timestamp: new Date().toISOString(),
  source: "demo",
};
