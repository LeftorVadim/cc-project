"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { DEMO_VESSEL } from "@/config/demoVessel";
import { INITIAL_VIEW, TILE_LAYER } from "@/config/map";

// Imports Leaflet directly, so it must only be loaded through MapLoader (ssr: false).
export default function SeaRadarMap() {
  const containerRef = useRef<HTMLDivElement>(null);

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

    const vessel = DEMO_VESSEL;
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

    L.marker([vessel.lat, vessel.lon], { icon: vesselIcon }).addTo(map);

    // Leaflet tracks window resize itself; this also covers container-only size changes.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="map" />;
}
