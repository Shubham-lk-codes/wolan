import { useEffect, useMemo, useRef, useState } from 'react';

const zoneColors = ['#6d28d9', '#0f9f68', '#e48a13', '#1686c9', '#d63b65', '#7c65d1'];
const markerColor = (driver) => driver.delayed ? '#dc2626' : driver.availability === 'AVAILABLE' ? '#15965a' : driver.availability === 'ON_DELIVERY' ? '#6d28d9' : driver.availability === 'BREAK' ? '#d97706' : '#697386';

function fallbackPosition(location, bounds) {
  const width = Math.max(0.001, bounds.maxLng - bounds.minLng);
  const height = Math.max(0.001, bounds.maxLat - bounds.minLat);
  return { left: `${8 + ((location.lng - bounds.minLng) / width) * 84}%`, top: `${8 + ((bounds.maxLat - location.lat) / height) * 84}%` };
}

function FallbackMap({ drivers, selectedDriverId, onSelect, showPackages, zones }) {
  const points = drivers.flatMap((driver) => [driver.location, showPackages ? driver.currentOrder?.packageLocation : null]).filter(Boolean);
  const bounds = points.reduce((result, point) => ({ minLat: Math.min(result.minLat, point.lat), maxLat: Math.max(result.maxLat, point.lat), minLng: Math.min(result.minLng, point.lng), maxLng: Math.max(result.maxLng, point.lng) }), { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity });
  if (!points.length) Object.assign(bounds, { minLat: 0.25, maxLat: 0.45, minLng: 32.48, maxLng: 32.68 });
  if (bounds.maxLat - bounds.minLat < 0.001) { bounds.minLat -= 0.01; bounds.maxLat += 0.01; }
  if (bounds.maxLng - bounds.minLng < 0.001) { bounds.minLng -= 0.01; bounds.maxLng += 0.01; }
  return <div className="fallback-map" aria-label="Live location coordinate view">
    <div className="fallback-zone zone-one"/><div className="fallback-zone zone-two"/>
    {zones.length > 0 && <span className="fallback-zone-note">{zones.length} delivery zone{zones.length === 1 ? '' : 's'} loaded</span>}
    {drivers.map((driver) => driver.location && <button type="button" className={`fallback-rider-marker ${selectedDriverId === driver.id ? 'selected' : ''} ${driver.idle ? 'idle' : ''}`} style={{ ...fallbackPosition(driver.location, bounds), '--marker': markerColor(driver) }} onClick={() => onSelect(driver.id)} aria-label={`View ${driver.name}${driver.idle ? ', idle' : ''}`} key={`rider-${driver.id}`}>{driver.name?.[0] || 'R'}</button>)}
    {showPackages && drivers.map((driver) => driver.currentOrder?.packageLocation && <span className="fallback-package-marker" style={fallbackPosition(driver.currentOrder.packageLocation, bounds)} key={`package-${driver.currentOrder.id}`}>◆</span>)}
    <div className="fallback-map-message"><b>Coordinate view active</b><span>Add VITE_GOOGLE_MAPS_API_KEY for the street map layer.</span></div>
  </div>;
}

export function LiveMapCanvas({ drivers, zones, selectedDriverId, onSelect, mapType, showZones, showPackages }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const fitSignatureRef = useRef('');
  const [mapReady, setMapReady] = useState(Boolean(window.google?.maps));
  const [mapFailed, setMapFailed] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || window.google?.maps) { if (window.google?.maps) setMapReady(true); return undefined; }
    let script = document.querySelector('script[data-wolan-google-maps]');
    const loaded = () => setMapReady(true);
    const failed = () => setMapFailed(true);
    if (!script) {
      script = document.createElement('script');
      script.dataset.wolanGoogleMaps = 'true';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    return () => { script.removeEventListener('load', loaded); script.removeEventListener('error', failed); };
  }, [apiKey]);

  useEffect(() => {
    if (!mapReady || !hostRef.current || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(hostRef.current, {
      center: { lat: 0.3476, lng: 32.5825 }, zoom: 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
    });
  }, [mapReady]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapType === 'SATELLITE' ? 'satellite' : mapType === 'TERRAIN' ? 'terrain' : 'roadmap');
  }, [mapType, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];
    const bounds = new window.google.maps.LatLngBounds();

    if (showZones) zones.forEach((zone, index) => {
      const paths = zone.boundary?.coordinates?.[0]?.map(([lng, lat]) => ({ lat, lng })) ?? [];
      if (paths.length < 3) return;
      const polygon = new window.google.maps.Polygon({ paths, map, strokeColor: zoneColors[index % zoneColors.length], strokeOpacity: .8, strokeWeight: 2, fillColor: zoneColors[index % zoneColors.length], fillOpacity: .12 });
      overlaysRef.current.push(polygon);
      paths.forEach((point) => bounds.extend(point));
    });

    drivers.forEach((driver) => {
      if (!driver.location) return;
      const position = { lat: driver.location.lat, lng: driver.location.lng };
      const marker = new window.google.maps.Marker({
        map, position, title: `${driver.name} · ${driver.displayStatus}${driver.idle ? ' · IDLE' : ''}`,
        label: { text: driver.name?.[0]?.toUpperCase() || 'R', color: '#ffffff', fontSize: '12px', fontWeight: '700' },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: selectedDriverId === driver.id ? 13 : 11, fillColor: markerColor(driver), fillOpacity: 1, strokeColor: driver.idle && !driver.delayed ? '#f59e0b' : '#ffffff', strokeWeight: driver.idle ? 5 : selectedDriverId === driver.id ? 4 : 3 },
        zIndex: selectedDriverId === driver.id ? 20 : 10,
      });
      marker.addListener('click', () => onSelect(driver.id));
      overlaysRef.current.push(marker);
      bounds.extend(position);
      const packageLocation = driver.currentOrder?.packageLocation;
      if (showPackages && packageLocation) {
        const packageMarker = new window.google.maps.Marker({
          map, position: { lat: packageLocation.lat, lng: packageLocation.lng }, title: `Package ${driver.currentOrder.packageTrackingId}`,
          icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, rotation: 45, scale: 6, fillColor: driver.currentOrder.mismatch ? '#dc2626' : '#6d28d9', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }, zIndex: 12,
        });
        packageMarker.addListener('click', () => onSelect(driver.id));
        overlaysRef.current.push(packageMarker);
        bounds.extend({ lat: packageLocation.lat, lng: packageLocation.lng });
      }
    });

    const signature = `${drivers.map((driver) => driver.id).sort().join(',')}|${selectedDriverId}|${showZones}|${showPackages}`;
    if (!bounds.isEmpty() && fitSignatureRef.current !== signature) {
      fitSignatureRef.current = signature;
      if (selectedDriverId) {
        const selected = drivers.find((driver) => driver.id === selectedDriverId)?.location;
        if (selected) { map.panTo(selected); if (map.getZoom() < 14) map.setZoom(14); }
      } else {
        map.fitBounds(bounds, 55);
        window.google.maps.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > 15) map.setZoom(15); });
      }
    }
  }, [drivers, mapReady, onSelect, selectedDriverId, showPackages, showZones, zones]);

  const visibleZones = useMemo(() => showZones ? zones : [], [showZones, zones]);
  const useFallback = !apiKey || mapFailed;
  return <div className="live-map-visual" role="application" aria-label="Live driver and package map">
    {!useFallback && <div className="google-map-host" ref={hostRef}/>} 
    {useFallback && <FallbackMap drivers={drivers} selectedDriverId={selectedDriverId} onSelect={onSelect} showPackages={showPackages} zones={visibleZones}/>} 
    {!useFallback && !mapReady && <div className="map-loading"><span/><b>Loading live map…</b></div>}
    <div className="live-map-legend"><span><i className="legend-driver"/> Rider</span><span><i className="legend-package"/> Package</span><span><i className="legend-delayed"/> Delayed</span><span><i className="legend-zone"/> Zone</span></div>
  </div>;
}
