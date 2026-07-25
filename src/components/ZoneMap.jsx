import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons for different exhibit states
const createIcon = (color, isActive = false) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background-color: ${color};
      border: 3px solid ${isActive ? '#fff' : '#333'};
      box-shadow: 0 0 ${isActive ? '8px rgba(33, 150, 243, 0.6)' : '4px rgba(0,0,0,0.3)'};
      animation: ${isActive ? 'pulse 2s infinite' : 'none'};
    "></div>
    <style>
      @keyframes pulse {
        0% { box-shadow: 0 0 8px rgba(33, 150, 243, 0.6); }
        50% { box-shadow: 0 0 20px rgba(33, 150, 243, 0.8); }
        100% { box-shadow: 0 0 8px rgba(33, 150, 243, 0.6); }
      }
      .navigation-path {
        animation: dash 2s linear infinite;
      }
      @keyframes dash {
        to {
          stroke-dashoffset: -20;
        }
      }
    </style>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// Singapore Science Centre GPS coordinates
const scienceCentreLocation = {
  center: [1.3286, 103.7768], // Singapore Science Centre main building
  zoom: 19, // High zoom for indoor navigation
  minZoom: 17,
  maxZoom: 22
};

// Floor plan overlay bounds for Singapore Science Centre building
// These bounds should match the exact building footprint on OpenStreetMap
const floorPlanBounds = {
  DWT: [
    [1.3282, 103.7765], // Southwest corner - Science of Ageing area
    [1.3290, 103.7771]  // Northeast corner - Science of Ageing area
  ],
  EAP: [
    [1.3284, 103.7766], // Southwest corner - Pink/Yellow zones
    [1.3288, 103.7770]  // Northeast corner - Pink/Yellow zones
  ]
};

// Zone-specific exhibit data mapped to real GPS coordinates at Singapore Science Centre
const zoneExhibits = {
  DWT: {
    name: 'Dialogue with Time (Science of Ageing)',
    center: [1.3286, 103.7768], // Science of Ageing area coordinates
    floorPlanImage: '/images/science-of-ageing-floor-plan.png',
    bounds: floorPlanBounds.DWT,
    exhibits: [
      // Real GPS coordinates within the Science of Ageing building section
      { id: 'DWT-01', name: 'Entrance Statement', position: [1.3289, 103.7766], active: false },
      { id: 'DWT-02', name: 'Kopi Talk', position: [1.3288, 103.7767], active: false },
      { id: 'DWT-03', name: 'Experiencing Dementia', position: [1.3287, 103.7768], active: false },
      { id: 'DWT-04', name: 'Brain', position: [1.3286, 103.7769], active: false },
      { id: 'DWT-05', name: 'Reaction Time Game', position: [1.3287, 103.7770], active: false },
      { id: 'DWT-06', name: 'Bones and Joints', position: [1.3288, 103.7769], active: false },
      { id: 'DWT-07', name: 'Cell Ageing', position: [1.3289, 103.7768], active: false },
      { id: 'DWT-08', name: 'Puberty', position: [1.3288, 103.7770], active: false },
      { id: 'DWT-09', name: 'Circulatory System', position: [1.3287, 103.7769], active: false },
      { id: 'DWT-10', name: 'Skin Ageing', position: [1.3286, 103.7770], active: false },
      { id: 'DWT-11', name: 'Did You Know?', position: [1.3285, 103.7769], active: false },
      { id: 'DWT-12', name: 'Cell Division', position: [1.3284, 103.7770], active: false },
      { id: 'DWT-13', name: 'Cell Growth', position: [1.3285, 103.7768], active: false },
      { id: 'DWT-14', name: 'Sense of Balance', position: [1.3286, 103.7767], active: false },
      { id: 'DWT-15', name: 'Tremor', position: [1.3285, 103.7767], active: false },
      { id: 'DWT-16', name: 'Complex Tasks', position: [1.3284, 103.7768], active: false },
      { id: 'DWT-17', name: 'Mobility', position: [1.3285, 103.7766], active: false },
      { id: 'DWT-18', name: 'Hearing', position: [1.3286, 103.7766], active: false },
      { id: 'DWT-19', name: 'Vision', position: [1.3287, 103.7766], active: false },
      { id: 'DWT-20', name: 'Hand-Eye Coordination', position: [1.3288, 103.7766], active: false },
      { id: 'DWT-21', name: 'Retirement Bench', position: [1.3289, 103.7767], active: false },
      { id: 'DWT-22', name: 'The Diversity of Ageing', position: [1.3290, 103.7767], active: false }
    ]
  },
  EAP: {
    name: 'Earth & Planetary Sciences',
    center: [1.3286, 103.7768], // Pink/Yellow zones area coordinates
    floorPlanImage: '/images/earth-planetary-floor-plan.png',
    bounds: floorPlanBounds.EAP,
    exhibits: [
      // Pink Zone and Yellow Zone exhibits mapped to real GPS coordinates
      { id: 'EAP-01', name: 'Earth Alive', position: [1.3284, 103.7769], active: false },
      { id: 'EAP-03', name: 'Bend the Carbon Curve', position: [1.3285, 103.7768], active: false },
      { id: 'EAP-04', name: 'Climate Chat', position: [1.3286, 103.7767], active: false },
      { id: 'EAP-05', name: 'Freeloader', position: [1.3287, 103.7768], active: false },
      { id: 'EAP-07', name: 'Disaster Teamwork', position: [1.3288, 103.7769], active: false },
      { id: 'EAP-08', name: 'Survivor Stories', position: [1.3287, 103.7770], active: false },
      { id: 'EAP-09', name: 'Typhoon Simulator', position: [1.3286, 103.7770], active: false },
      { id: 'EAP-10', name: 'Condensation and Evaporation', position: [1.3285, 103.7770], active: false },
      { id: 'EAP-11', name: 'Rain and Terrain', position: [1.3284, 103.7770], active: false },
      { id: 'EAP-16', name: 'Swirling Storms', position: [1.3289, 103.7768], active: false },
      { id: 'EAP-17', name: 'Sandflow', position: [1.3290, 103.7767], active: false },
      { id: 'EAP-18', name: 'Atmosphere Hydrosphere', position: [1.3289, 103.7766], active: false },
      { id: 'EAP-19', name: 'Building for Quakes', position: [1.3288, 103.7766], active: false },
      { id: 'EAP-20', name: 'Un-solid Ground', position: [1.3287, 103.7766], active: false },
      { id: 'EAP-21', name: 'Seeing Earth', position: [1.3286, 103.7766], active: false },
      { id: 'EAP-27', name: 'Measuring Quakes', position: [1.3285, 103.7767], active: false },
      { id: 'EAP-28', name: 'Shaking Waves', position: [1.3284, 103.7768], active: false },
      { id: 'EAP-29', name: 'GeoSphere', position: [1.3283, 103.7769], active: false },
      { id: 'EAP-30', name: 'Earth-quake', position: [1.3282, 103.7770], active: false },
      { id: 'EAP-31', name: 'Folded Rocks', position: [1.3283, 103.7770], active: false },
      { id: 'EAP-32', name: 'Rock Slices', position: [1.3284, 103.7771], active: false },
      { id: 'EAP-33', name: 'Singapore Rocks', position: [1.3285, 103.7771], active: false },
      { id: 'EAP-34', name: 'Microfossils', position: [1.3286, 103.7771], active: false },
      { id: 'EAP-35', name: 'Volcano', position: [1.3287, 103.7771], active: false }
    ]
  }
};

// Function to get the next exhibit in the sequence for navigation
const getNextExhibit = (currentExhibitId, zone) => {
  if (!currentExhibitId || !zone) return null;

  const exhibits = zoneExhibits[zone]?.exhibits;
  if (!exhibits) return null;

  const currentIndex = exhibits.findIndex(exhibit => exhibit.id === currentExhibitId);
  if (currentIndex === -1) return null;

  // Get next exhibit in sequence, or loop back to first if at the end
  const nextIndex = currentIndex + 1 < exhibits.length ? currentIndex + 1 : 0;
  return exhibits[nextIndex];
};

// Function to create a navigation path between two points
const createNavigationPath = (fromPosition, toPosition) => {
  if (!fromPosition || !toPosition) return [];

  // Simple direct line for now - could be enhanced with more realistic pathfinding
  // Add some intermediate points to create a slightly curved path
  const [fromLat, fromLng] = fromPosition;
  const [toLat, toLng] = toPosition;

  // Calculate midpoint with slight offset for curved effect
  const midLat = (fromLat + toLat) / 2 + (Math.random() - 0.5) * 0.0001;
  const midLng = (fromLng + toLng) / 2 + (Math.random() - 0.5) * 0.0001;

  return [
    fromPosition,
    [midLat, midLng],
    toPosition
  ];
};

const MapUpdater = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
};

const ZoneMap = ({ zone = 'DWT', currentExhibit = null, onExhibitSelect = null }) => {
  const mapRef = useRef(null);
  const zoneData = zoneExhibits[zone];

  if (!zoneData) {
    return (
      <div className="zone-map-error">
        <p>Zone "{zone}" not found. Available zones: DWT, EAP</p>
      </div>
    );
  }

  // Update exhibit active state based on current detection
  const exhibitsWithActiveState = zoneData.exhibits.map(exhibit => ({
    ...exhibit,
    active: currentExhibit && exhibit.id === currentExhibit.id
  }));

  // Get next exhibit and create navigation path
  const nextExhibit = currentExhibit ? getNextExhibit(currentExhibit.id, zone) : null;
  const currentExhibitData = currentExhibit ?
    zoneData.exhibits.find(exhibit => exhibit.id === currentExhibit.id) : null;

  const navigationPath = (currentExhibitData && nextExhibit) ?
    createNavigationPath(currentExhibitData.position, nextExhibit.position) : [];

  const handleExhibitClick = (exhibit) => {
    console.log(`Selected exhibit: ${exhibit.id} - ${exhibit.name}`);
    if (onExhibitSelect) {
      onExhibitSelect({
        id: exhibit.id,
        name: exhibit.name,
        zone: zone,
        position: exhibit.position
      });
    }
  };

  return (
    <div className="zone-map-container" style={{ height: '400px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <div className="zone-map-header" style={{
        padding: '10px',
        background: zone === 'DWT' ? '#1e3a8a' : '#16a34a',
        color: 'white',
        fontWeight: 'bold'
      }}>
        {zone === 'DWT' ? '🧠 Dialogue with Time (Science of Ageing)' : '🌍 Earth & Planetary Sciences'}
        {currentExhibit && (
          <span style={{ float: 'right', fontSize: '14px' }}>
            📍 {currentExhibit.name}
            {nextExhibit && <span style={{ marginLeft: '10px' }}>→ {nextExhibit.name}</span>}
          </span>
        )}
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
          📍 Singapore Science Centre • {zoneData.floorPlanImage ? 'Floor Plan Overlay' : 'OpenStreetMap View'}
        </div>
      </div>

      <MapContainer
        ref={mapRef}
        center={scienceCentreLocation.center}
        zoom={scienceCentreLocation.zoom}
        style={{ height: 'calc(100% - 50px)', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
        minZoom={scienceCentreLocation.minZoom}
        maxZoom={scienceCentreLocation.maxZoom}
      >
        <MapUpdater center={zoneData.center} zoom={scienceCentreLocation.zoom} />

        {/* OpenStreetMap base layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Floor plan overlay on top of OpenStreetMap */}
        {zoneData.floorPlanImage && (
          <ImageOverlay
            url={zoneData.floorPlanImage}
            bounds={zoneData.bounds}
            opacity={0.7}
          />
        )}

        {/* Navigation path from current to next exhibit */}
        {navigationPath.length > 0 && (
          <Polyline
            positions={navigationPath}
            pathOptions={{
              color: '#FF6B6B',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 10',
              className: 'navigation-path'
            }}
          />
        )}

        {/* Next exhibit marker with different style */}
        {nextExhibit && (
          <Marker
            position={nextExhibit.position}
            icon={createIcon('#FF6B6B', false)}
          >
            <Popup>
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <strong>Next: {nextExhibit.id}</strong><br />
                <span style={{ fontSize: '14px' }}>{nextExhibit.name}</span><br />
                <div style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  backgroundColor: '#FF6B6B',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  🧭 Suggested Next Stop
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {exhibitsWithActiveState.map((exhibit) => (
          <Marker
            key={exhibit.id}
            position={exhibit.position}
            icon={createIcon(
              exhibit.active ? '#2196F3' : (zone === 'DWT' ? '#1e3a8a' : '#16a34a'),
              exhibit.active
            )}
            eventHandlers={{
              click: () => handleExhibitClick(exhibit)
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <strong>{exhibit.id}</strong><br />
                <span style={{ fontSize: '14px' }}>{exhibit.name}</span><br />
                <button
                  style={{
                    marginTop: '8px',
                    padding: '4px 12px',
                    backgroundColor: zone === 'DWT' ? '#1e3a8a' : '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleExhibitClick(exhibit)}
                >
                  Navigate Here
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default ZoneMap;