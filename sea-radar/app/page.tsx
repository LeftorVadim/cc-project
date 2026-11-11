import MapLoader from "@/components/MapLoader";

export default function Home() {
  return (
    <>
      <h1 className="header">Sea Radar</h1>
      <p>Демонстрационные данные</p>
      <main className="map-area">
        <MapLoader />
      </main>
    </>
  );
}
