import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const POINTS = [
  { id: 1, name: "Al-Shamali Complex", lat: 32.5568, lng: 35.8502 },
  { id: 2, name: "Sheikh Khalil Complex", lat: 32.5487, lng: 35.8433 },
  { id: 3, name: "Amman Complex", lat: 32.5421, lng: 35.8394 },
  { id: "dest", name: "42 Irbid (Destination)", lat: 32.5561, lng: 35.8516 }
];

export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
    else if (user.role !== "student") setLocation(user.role === "admin" ? "/admin" : "/driver");
  }, [user, setLocation]);

  if (!user) return null;

  const polylineCoords: [number, number][] = POINTS.map(p => [p.lat, p.lng]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="border border-border p-4 bg-card shrink-0">
        <h1 className="text-xl font-bold text-primary mb-2">{">"} ROUTE_MAP</h1>
        <div className="text-sm text-muted-foreground">
          DISPLAYING_AUTHORIZED_PICKUP_POINTS_AND_DESTINATION
        </div>
      </div>

      <div className="border border-border p-2 grow min-h-[500px]">
        <MapContainer 
          center={[32.55, 35.845]} 
          zoom={14} 
          style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {POINTS.map((point) => (
            <Marker key={point.id} position={[point.lat, point.lng]}>
              <Popup className="font-mono">
                <div className="font-bold text-black">{point.name}</div>
                <div className="text-xs text-gray-600">LAT: {point.lat}</div>
                <div className="text-xs text-gray-600">LNG: {point.lng}</div>
              </Popup>
            </Marker>
          ))}
          <Polyline 
            positions={polylineCoords} 
            color="#00FF00" 
            weight={3} 
            opacity={0.7} 
            dashArray="10, 10"
          />
        </MapContainer>
      </div>
    </div>
  );
}
