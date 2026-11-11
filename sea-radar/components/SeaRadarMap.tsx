"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { DEMO_TICK_MS, DEMO_VESSELS } from "@/config/demoVessel";
import { INITIAL_VIEW, TILE_LAYER } from "@/config/map";
import type { Vessel } from "@/types/vessel";

// Imports Leaflet directly, so it must only be loaded through MapLoader (ssr: false).
function initialBearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function createInitialVessels(): Vessel[] {
  return DEMO_VESSELS.map(({ route, ...vessel }) => ({
    ...vessel,
    lat: route[0].lat,
    lon: route[0].lon,
    courseDeg: initialBearing(route[0], route[1]),
    timestamp: new Date().toISOString(),
    source: "demo",
  }));
}

export default function SeaRadarMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeIndicesRef = useRef<Record<string, number>>({});
  const [vessels, setVessels] = useState<Vessel[]>(createInitialVessels);
  const vesselsRef = useRef(vessels);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container).setView(
      [INITIAL_VIEW.center.lat, INITIAL_VIEW.center.lon],
      INITIAL_VIEW.zoom,
    );

    L.tileLayer(TILE_LAYER.url, {
      attribution: TILE_LAYER.attribution,
      maxZoom: TILE_LAYER.maxZoom,
    }).addTo(map);

    DEMO_VESSELS.forEach(({ id, route }) => {
      const icon = L.divIcon({
        className: "vessel-marker",
        html: `
          <span
            class="vessel-marker__shape"
            data-vessel-id="${id}"
            data-icon="course"
          ></span>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker([route[0].lat, route[0].lon], { icon })
        .addTo(map)
        .on("click", () => setSelectedVesselId(id));
      markersRef.current.set(id, marker);
    });

    // Leaflet tracks window resize itself; this also covers container-only size changes.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    vessels.forEach((vessel) => {
      const marker = markersRef.current.get(vessel.id);
      if (!marker) return;

      marker.setLatLng([vessel.lat, vessel.lon]);
      const shape = marker.getElement()?.querySelector<HTMLElement>(".vessel-marker__shape");
      if (shape) {
        shape.dataset.icon = vessel.courseDeg === null ? "neutral" : "course";
        shape.style.transform = `rotate(${vessel.courseDeg ?? 0}deg)`;
      }
    });
  }, [vessels]);

  useEffect(() => {
    routeIndicesRef.current = Object.fromEntries(DEMO_VESSELS.map(({ id }) => [id, 0]));
    const startedAt = new Date().toISOString();
    const startedVessels = vesselsRef.current.map((vessel) => ({ ...vessel, timestamp: startedAt }));
    vesselsRef.current = startedVessels;
    setVessels(startedVessels);

    const timer = window.setInterval(() => {
      const timestamp = new Date().toISOString();
      let changed = false;
      const next = vesselsRef.current.map((vessel) => {
        const route = DEMO_VESSELS.find((candidate) => candidate.id === vessel.id)?.route;
        const routeIndex = routeIndicesRef.current[vessel.id] ?? 0;
        if (!route || routeIndex >= route.length - 1) return vessel;

        const nextIndex = routeIndex + 1;
        const point = route[nextIndex];
        routeIndicesRef.current[vessel.id] = nextIndex;
        changed = true;

        return {
          ...vessel,
          lat: point.lat,
          lon: point.lon,
          speedKnots: nextIndex === route.length - 1 ? 0 : vessel.speedKnots,
          courseDeg: initialBearing(route[nextIndex - 1], point),
          timestamp,
        };
      });

      if (changed) {
        vesselsRef.current = next;
        setVessels(next);
      }
    }, DEMO_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const selectedVessel = vessels.find((vessel) => vessel.id === selectedVesselId) ?? null;
  const formatSpeed = (speed: number | null) =>
    speed === null ? "Нет данных" : `${Number(speed.toFixed(1))} уз`;
  const formatCourse = (course: number | null) =>
    course === null ? "Нет данных" : `${Math.round(course) % 360}°`;
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? "Нет данных"
      : `${date.toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false })} UTC`;
  };

  return (
    <>
      <div ref={containerRef} className="map" />
      <aside className="vessel-panel">
        <p className="source-label">Демонстрационные данные</p>
        {selectedVessel && (
          <section className="vessel-card" aria-label="Карточка судна">
            <h2>{selectedVessel.id}</h2>
            <dl>
              <dt>Название</dt>
              <dd>{selectedVessel.name ?? "Нет данных"}</dd>
              <dt>Координаты</dt>
              <dd>{`${selectedVessel.lat.toFixed(5)}, ${selectedVessel.lon.toFixed(5)}`}</dd>
              <dt>Скорость</dt>
              <dd>{formatSpeed(selectedVessel.speedKnots)}</dd>
              <dt>Курс</dt>
              <dd>{formatCourse(selectedVessel.courseDeg)}</dd>
              <dt>Время сообщения</dt>
              <dd>{formatTimestamp(selectedVessel.timestamp)}</dd>
              <dt>Источник</dt>
              <dd>{selectedVessel.source === "demo" ? "Демонстрационные данные" : "AISStream"}</dd>
            </dl>
          </section>
        )}
      </aside>
    </>
  );
}
