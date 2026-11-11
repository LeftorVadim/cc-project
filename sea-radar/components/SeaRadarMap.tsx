"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { DEMO_VESSEL_DATA } from "@/config/demoVessel";
import { INITIAL_VIEW, TILE_LAYER } from "@/config/map";
import type { Vessel } from "@/types/vessel";

// Imports Leaflet directly, so it must only be loaded through MapLoader (ssr: false).
export default function SeaRadarMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);

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

    DEMO_VESSEL_DATA.forEach((vessel) => {
      const iconType = vessel.courseDeg === null ? "neutral" : "course";
      const rotation = vessel.courseDeg ?? 0;
      const vesselIcon = L.divIcon({
        className: "vessel-marker",
        html: `
          <span
            class="vessel-marker__shape"
            data-vessel-id="${vessel.id}"
            data-icon="${iconType}"
            style="transform: rotate(${rotation}deg)"
          ></span>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([vessel.lat, vessel.lon], { icon: vesselIcon })
        .addTo(map)
        .on("click", () => setSelectedVessel(vessel));
    });

    // Leaflet tracks window resize itself; this also covers container-only size changes.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, []);

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
