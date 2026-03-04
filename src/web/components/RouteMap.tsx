import 'leaflet/dist/leaflet.css';
import type { LatLngBoundsExpression } from 'leaflet';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';
import { useMap } from 'react-leaflet';
import type { Checkpoint } from '../../core/customSegments';
import type { RoutePoint } from '../../core/types';

interface RouteMapProps {
  profile: RoutePoint[];
  checkpoints: Checkpoint[];
}

type LatLng = [number, number];

function FitToRoute({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [26, 26] });
  }, [bounds, map]);

  return null;
}

function nearestPointByDistance(profile: RoutePoint[], checkpointKm: number): RoutePoint | null {
  if (profile.length === 0) {
    return null;
  }

  let best = profile[0];
  let bestDelta = Math.abs((best.distM / 1000) - checkpointKm);
  for (let i = 1; i < profile.length; i += 1) {
    const point = profile[i];
    const delta = Math.abs((point.distM / 1000) - checkpointKm);
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }

  return best;
}

export function RouteMap({ profile, checkpoints }: RouteMapProps) {
  if (profile.length < 2) {
    return null;
  }

  const path: LatLng[] = profile.map((point) => [point.lat, point.lon]);
  const start = profile[0];
  const finish = profile[profile.length - 1];

  const checkpointMarkers = checkpoints
    .map((checkpoint) => {
      const nearest = nearestPointByDistance(profile, checkpoint.km);
      if (!nearest) {
        return null;
      }

      return {
        id: checkpoint.id,
        name: checkpoint.name,
        km: checkpoint.km,
        lat: nearest.lat,
        lon: nearest.lon,
      };
    })
    .filter((cp): cp is { id: string; name: string; km: number; lat: number; lon: number } => cp !== null);

  return (
    <section className="panel route-map-panel">
      <h3>Route Map</h3>
      <p className="hint-text">Street map route preview with start/finish and checkpoint markers.</p>
      <div className="route-map-wrap">
        <MapContainer className="route-map-leaflet" center={path[0]} zoom={12} scrollWheelZoom zoomControl>
          <FitToRoute bounds={path} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polyline positions={path} pathOptions={{ color: '#0f766e', weight: 4, opacity: 0.95 }} />

          <CircleMarker center={[start.lat, start.lon]} radius={7} pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.9 }}>
            <Popup>Start</Popup>
          </CircleMarker>

          <CircleMarker
            center={[finish.lat, finish.lon]}
            radius={7}
            pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.9 }}
          >
            <Popup>Finish</Popup>
          </CircleMarker>

          {checkpointMarkers.map((cp) => (
            <CircleMarker
              key={cp.id}
              center={[cp.lat, cp.lon]}
              radius={6}
              pathOptions={{ color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: 0.92 }}
            >
              <Popup>
                {cp.name} ({cp.km.toFixed(2)} km)
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
