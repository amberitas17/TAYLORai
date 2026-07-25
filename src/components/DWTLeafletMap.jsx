import React, { useState, useEffect } from 'react';
import { MapContainer, Marker, Popup, Polyline, Rectangle, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DWTLeafletMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // Following EXACT positions from both photos
  const dwtExhibits = [
    // Science of Ageing Gallery (01-14) - from first photo
    { id: 'DWT-01', name: 'Entrance Statement', position: [550, 400], number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', position: [520, 380], number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', position: [480, 420], number: '03' },
    { id: 'DWT-04', name: 'Brain', position: [460, 460], number: '04' },
    { id: 'DWT-05', name: 'Reaction Time Game', position: [500, 500], number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', position: [540, 540], number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', position: [480, 580], number: '07' },
    { id: 'DWT-08', name: 'Puberty', position: [420, 600], number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', position: [360, 580], number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', position: [320, 540], number: '10' },
    { id: 'DWT-11', name: 'Did You Know?', position: [300, 500], number: '11' },
    { id: 'DWT-12', name: 'Cell Division', position: [320, 460], number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', position: [380, 420], number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', position: [420, 400], number: '14' },

    // Yellow Zone (15-21) - from second photo
    { id: 'DWT-15', name: 'Tremor', position: [520, 180], number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', position: [480, 160], number: '16' },
    { id: 'DWT-17', name: 'Mobility', position: [440, 140], number: '17' },
    { id: 'DWT-18', name: 'Hearing', position: [400, 120], number: '18' },
    { id: 'DWT-19', name: 'Vision', position: [360, 100], number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', position: [320, 120], number: '20' },
    { id: 'DWT-21', name: 'Retirement Bench', position: [280, 140], number: '21' },

    // Pink Zone (only 22) - from second photo
    { id: 'DWT-22', name: 'The Diversity of Ageing', position: [240, 160], number: '22' }
  ];

  // Indoor map bounds for pixel coordinates
  const mapBounds = [[0, 0], [800, 800]];
  const mapCenter = [400, 400];

  // Angular floor plan matching the reference map layout
  const floorPlanBounds = [
    // Main Science of Ageing gallery - angular shape
    [[0.10, 0.10], [0.90, 1.00]],
  ];

  // Central circular area
  const centralCircle = {
    center: [0.45, 0.45],
    radius: 0.08,
    color: '#8E44AD',
    fillColor: '#B47EB8',
    fillOpacity: 0.2,
    weight: 2
  };

  // Create custom icons for different states
  const createCustomIcon = (exhibit, isActive = false, isNext = false) => {
    const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
    const size = isActive ? 35 : isNext ? 30 : 25;

    return L.divIcon({
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${color}, ${isActive ? '#1976D2' : isNext ? '#E53935' : '#5E35B1'});
          border: 3px solid white;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${size > 30 ? '12px' : '10px'};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ${isActive ? 'animation: pulse 2s infinite;' : ''}
          z-index: 1000;
          position: relative;
        ">
          ${exhibit.number}
        </div>
        <style>
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        </style>
      `,
      className: 'custom-div-icon',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  };

  // Get next exhibit in sequence
  const getNextExhibit = (currentExhibitId) => {
    if (!currentExhibitId) return null;
    const currentIndex = dwtExhibits.findIndex(exhibit => exhibit.id === currentExhibitId);
    if (currentIndex === -1) return null;
    const nextIndex = currentIndex + 1 < dwtExhibits.length ? currentIndex + 1 : 0;
    return dwtExhibits[nextIndex];
  };

  const currentExhibitData = currentExhibit ?
    dwtExhibits.find(exhibit => exhibit.id === currentExhibit.id) : null;
  const nextExhibit = currentExhibitData ? getNextExhibit(currentExhibitData.id) : null;

  // Create navigation path
  const createNavigationPath = () => {
    if (!currentExhibitData || !nextExhibit) return [];

    return [
      currentExhibitData.position,
      nextExhibit.position
    ];
  };

  const handleExhibitClick = (exhibit) => {
    setSelectedExhibit(exhibit);
    if (onExhibitSelect) {
      onExhibitSelect({
        id: exhibit.id,
        name: exhibit.name,
        zone: 'DWT',
        position: exhibit.position
      });
    }
  };

  return (
    <div style={{
      height: '600px',
      width: '100%',
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '4px'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '16px 16px 0 0'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: '700',
              letterSpacing: '-0.025em'
            }}>
              Science of Ageing
            </h2>
            <p style={{
              margin: '6px 0 0 0',
              fontSize: '15px',
              opacity: 0.95,
              fontWeight: '500'
            }}>
              Indoor Floor Plan • Singapore Science Centre
            </p>
          </div>
          {currentExhibitData && (
            <div style={{
              textAlign: 'right',
              fontSize: '14px',
              background: 'rgba(255,255,255,0.15)',
              padding: '12px 16px',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>📍 {currentExhibitData.name}</div>
              {nextExhibit && (
                <div style={{ opacity: 0.9, marginTop: '4px', fontSize: '13px' }}>
                  → {nextExhibit.name}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Indoor Floor Plan Map */}
      <div style={{
        height: 'calc(100% - 80px)',
        borderRadius: '0 0 16px 16px',
        overflow: 'hidden'
      }}>
        <MapContainer
          center={mapCenter}
          zoom={0}
          minZoom={-1}
          maxZoom={2}
          style={{ height: '100%', width: '100%', backgroundColor: '#F8FAFC' }}
          zoomControl={true}
          scrollWheelZoom={true}
          crs={L.CRS.Simple}
          maxBounds={[[-100, -100], [900, 900]]}
          maxBoundsViscosity={0.8}
        >
          {/* Science of Ageing Gallery Floor Plan - Pentagon Shape */}
          <Rectangle
            bounds={[[240, 350], [520, 600]]}
            pathOptions={{
              color: '#8E44AD',
              fillColor: '#E8F4FD',
              fillOpacity: 0.3,
              weight: 4
            }}
          />

          {/* Yellow Zone */}
          <Rectangle
            bounds={[[350, 80], [540, 220]]}
            pathOptions={{
              color: '#FFD700',
              fillColor: '#FFFF99',
              fillOpacity: 0.3,
              weight: 3
            }}
          />

          {/* Pink Zone */}
          <Rectangle
            bounds={[[220, 80], [350, 220]]}
            pathOptions={{
              color: '#FF69B4',
              fillColor: '#FFB6C1',
              fillOpacity: 0.3,
              weight: 3
            }}
          />

          {/* Navigation path */}
          {currentExhibitData && nextExhibit && (
            <Polyline
              positions={createNavigationPath()}
              pathOptions={{
                color: '#FF4757',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10'
              }}
            />
          )}

          {/* Exhibit markers */}
          {dwtExhibits.map((exhibit) => {
            const isActive = currentExhibitData && exhibit.id === currentExhibitData.id;
            const isNext = nextExhibit && exhibit.id === nextExhibit.id;

            return (
              <Marker
                key={exhibit.id}
                position={exhibit.position}
                icon={createCustomIcon(exhibit, isActive, isNext)}
                eventHandlers={{
                  click: () => handleExhibitClick(exhibit)
                }}
              >
                <Popup>
                  <div style={{
                    padding: '8px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    <h3 style={{ margin: '0 0 8px 0', color: '#8E44AD', fontSize: '16px' }}>
                      {exhibit.id}
                    </h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                      {exhibit.name}
                    </p>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Science of Ageing Gallery
                    </div>
                    {isActive && (
                      <div style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        background: '#4285F4',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>
                        📍 Current Location
                      </div>
                    )}
                    {isNext && (
                      <div style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        background: '#FF4757',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center'
                      }}>
                        🎯 Next Exhibit
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default DWTLeafletMap;