import type { LatLon } from "@/config/map";
import type { Vessel } from "@/types/vessel";

type DemoVesselConfig = Omit<Vessel, "lat" | "lon" | "timestamp" | "source"> & {
  route: readonly LatLon[];
};

export const DEMO_VESSELS: readonly DemoVesselConfig[] = [
  {
    id: "demo-1",
    name: "Демо-судно 1",
    speedKnots: 12.3,
    courseDeg: 69,
    route: [
      { lat: 50.88, lon: 1.12 },
      { lat: 50.90, lon: 1.20 },
      { lat: 50.92, lon: 1.28 },
      { lat: 50.94, lon: 1.36 },
      { lat: 50.96, lon: 1.44 },
      { lat: 50.98, lon: 1.52 },
      { lat: 51.00, lon: 1.60 },
      { lat: 51.02, lon: 1.68 },
    ],
  },
  {
    id: "demo-2",
    name: "Демо-судно 2",
    speedKnots: 8,
    courseDeg: 225,
    route: [
      { lat: 51.16, lon: 1.82 },
      { lat: 51.14, lon: 1.74 },
      { lat: 51.12, lon: 1.66 },
      { lat: 51.10, lon: 1.58 },
      { lat: 51.08, lon: 1.50 },
      { lat: 51.06, lon: 1.42 },
      { lat: 51.04, lon: 1.34 },
      { lat: 51.02, lon: 1.26 },
      { lat: 51.00, lon: 1.18 },
    ],
  },
  {
    id: "demo-3",
    name: "Демо-судно 3",
    speedKnots: 10.5,
    courseDeg: 84,
    route: [
      { lat: 51.02, lon: 1.22 },
      { lat: 51.025, lon: 1.30 },
      { lat: 51.03, lon: 1.38 },
      { lat: 51.035, lon: 1.46 },
      { lat: 51.04, lon: 1.54 },
      { lat: 51.045, lon: 1.62 },
      { lat: 51.05, lon: 1.70 },
      { lat: 51.055, lon: 1.78 },
    ],
  },
];

export const DEMO_VESSEL_DATA: Vessel[] = DEMO_VESSELS.map(({ route, ...vessel }) => ({
  ...vessel,
  lat: route[0].lat,
  lon: route[0].lon,
  timestamp: new Date().toISOString(),
  source: "demo",
}));
