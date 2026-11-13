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

type SnapshotSuccess = {
  ok: true;
  vessels: Vessel[];
  collectedAt: string;
  windowSeconds: number;
  count: number;
  truncated: boolean;
  reason: "window_elapsed" | "limit_reached";
};

type SnapshotError = {
  ok: false;
  attemptedAt: string;
  error: { code: string; message: string };
};

type ViewState =
  | { kind: "idle-demo" }
  | { kind: "loading" }
  | { kind: "success"; snapshot: SnapshotSuccess }
  | { kind: "empty"; snapshot: SnapshotSuccess }
  | { kind: "error"; result: SnapshotError };

export default function SeaRadarMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeIndicesRef = useRef<Record<string, number>>({});
  const fittedSnapshotRef = useRef(false);
  const [vessels, setVessels] = useState<Vessel[]>(createInitialVessels);
  const vesselsRef = useRef(vessels);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>({ kind: "idle-demo" });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container).setView(
      [INITIAL_VIEW.center.lat, INITIAL_VIEW.center.lon],
      INITIAL_VIEW.zoom,
    );
    mapRef.current = map;

    L.tileLayer(TILE_LAYER.url, {
      attribution: TILE_LAYER.attribution,
      maxZoom: TILE_LAYER.maxZoom,
    }).addTo(map);

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(vessels.map(({ id }) => id));
    for (const [id, marker] of markersRef.current) {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    vessels.forEach((vessel) => {
      let marker = markersRef.current.get(vessel.id);
      if (!marker) {
        const icon = L.divIcon({
          className: "vessel-marker",
          html: `<span class="vessel-marker__shape" data-vessel-id="${encodeURIComponent(vessel.id)}" data-icon="course"></span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        marker = L.marker([vessel.lat, vessel.lon], { icon })
          .addTo(map)
          .on("click", () => setSelectedVesselId(vessel.id));
        markersRef.current.set(vessel.id, marker);
      } else {
        marker.setLatLng([vessel.lat, vessel.lon]);
      }

      const shape = marker.getElement()?.querySelector<HTMLElement>(".vessel-marker__shape");
      if (shape) {
        shape.dataset.vesselId = vessel.id;
        shape.dataset.icon = vessel.courseDeg === null ? "neutral" : "course";
        shape.style.transform = `rotate(${vessel.courseDeg ?? 0}deg)`;
      }
    });

    if (
      viewState.kind === "success" &&
      viewState.snapshot.count > 0 &&
      !fittedSnapshotRef.current
    ) {
      map.setView(
        [INITIAL_VIEW.center.lat, INITIAL_VIEW.center.lon],
        INITIAL_VIEW.zoom,
      );
      fittedSnapshotRef.current = true;
    }
  }, [vessels, viewState]);

  useEffect(() => {
    if (viewState.kind !== "idle-demo") return;

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
  }, [viewState.kind]);

  async function loadSnapshot() {
    setViewState({ kind: "loading" });
    setVessels([]);
    vesselsRef.current = [];
    setSelectedVesselId(null);

    try {
      const response = await fetch("/api/snapshot");
      const result: SnapshotSuccess | SnapshotError = await response.json();
      if (!response.ok || !result.ok) {
        setViewState({ kind: "error", result: result as SnapshotError });
        return;
      }

      // The API already deduplicates by MMSI; protect the map from duplicate IDs as well.
      const uniqueVessels = [...new Map(result.vessels.map((vessel) => [vessel.id, vessel])).values()];
      const snapshot = { ...result, vessels: uniqueVessels, count: uniqueVessels.length };
      vesselsRef.current = uniqueVessels;
      setVessels(uniqueVessels);
      setViewState({ kind: uniqueVessels.length === 0 ? "empty" : "success", snapshot });
    } catch {
      setViewState({
        kind: "error",
        result: {
          ok: false,
          attemptedAt: new Date().toISOString(),
          error: { code: "network_error", message: "Не удалось подключиться к источнику" },
        },
      });
    }
  }

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
  const sourceLabel = (() => {
    switch (viewState.kind) {
      case "idle-demo": return "Демонстрационные данные";
      case "loading": return "Загрузка…";
      case "success":
      case "empty": {
        const { snapshot } = viewState;
        const receivedAt = formatTimestamp(snapshot.collectedAt);
        return `AISStream · снимок за 15 с · получен ${receivedAt} · судов: ${snapshot.count} · выборка неполная${snapshot.truncated ? " · остановлено на лимите 100" : ""}`;
      }
      case "error": return "Данных на карте нет";
    }
  })();

  return (
    <>
      <div ref={containerRef} className="map" />
      <aside className="vessel-panel" aria-live="polite">
        <p className="source-label">{sourceLabel}</p>
        <button type="button" onClick={loadSnapshot} disabled={viewState.kind === "loading"}>
          Загрузить настоящие позиции
        </button>
        {viewState.kind === "empty" && <p role="status">За время сбора позиции не получены</p>}
        {viewState.kind === "error" && (
          <p role="alert">Не удалось получить данные: {viewState.result.error.message}</p>
        )}
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
