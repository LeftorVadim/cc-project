import type { LatLon } from "@/config/map";
import type { Vessel } from "@/types/vessel";

type DemoVesselConfig = Omit<Vessel, "lat" | "lon" | "courseDeg" | "timestamp" | "source"> & {
  route: readonly LatLon[];
};

export const DEMO_TICK_MS = 2000;

export const DEMO_VESSELS: readonly DemoVesselConfig[] = [
  {
    id: "demo-1",
    name: "Демо-судно 1",
    speedKnots: 12.3,
    route: [
      { lat: 50.88, lon: 1.12 },
      { lat: 50.895, lon: 1.18 },
      { lat: 50.91, lon: 1.24 },
      { lat: 50.925, lon: 1.30 },
      { lat: 50.94, lon: 1.36 },
      { lat: 50.955, lon: 1.42 },
      { lat: 50.97, lon: 1.48 },
      { lat: 50.985, lon: 1.54 },
      { lat: 51.00, lon: 1.60 },
      { lat: 51.02, lon: 1.68 },
    ],
  },
  {
    id: "demo-2",
    name: "Демо-судно 2",
    speedKnots: 8,
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
