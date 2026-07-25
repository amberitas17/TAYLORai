import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const DWTMapLibreMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // DWT exhibits positioned exactly as shown in the original reference map
  // Using indoor coordinate system (longitude/latitude equivalent for indoor space)
  const dwtExhibits = [
    // Bottom row - left to right as shown in original (01-10)
    { id: 'DWT-01', name: 'Entrance Statement', lng: -0.8, lat: -0.3, number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', lng: -0.6, lat: -0.3, number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', lng: -0.4, lat: -0.3, number: '03' },
    { id: 'DWT-04', name: 'Brain', lng: -0.2, lat: -0.3, number: '04' },
    { id: 'DWT-05', name: 'Reaction Time Game', lng: 0, lat: -0.3, number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', lng: 0.2, lat: -0.3, number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', lng: 0.4, lat: -0.3, number: '07' },
    { id: 'DWT-08', name: 'Puberty', lng: 0.6, lat: -0.3, number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', lng: 0.8, lat: -0.3, number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', lng: 1.0, lat: -0.3, number: '10' },

    // Right wall going up (11-17)
    { id: 'DWT-11', name: 'Did You Know?', lng: 1.0, lat: -0.1, number: '11' },
    { id: 'DWT-12', name: 'Cell Division', lng: 1.0, lat: 0.1, number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', lng: 1.0, lat: 0.3, number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', lng: 1.0, lat: 0.5, number: '14' },
    { id: 'DWT-15', name: 'Tremor', lng: 1.0, lat: 0.7, number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', lng: 1.0, lat: 0.9, number: '16' },
    { id: 'DWT-17', name: 'Mobility', lng: 1.0, lat: 1.1, number: '17' },

    // Top row going left (18-20)
    { id: 'DWT-18', name: 'Hearing', lng: 0.8, lat: 1.3, number: '18' },
    { id: 'DWT-19', name: 'Vision', lng: 0.6, lat: 1.5, number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', lng: 0.4, lat: 1.5, number: '20' },

    // Interior exhibits (21-22)
    { id: 'DWT-21', name: 'Retirement Bench', lng: 0, lat: 0.3, number: '21' },
    { id: 'DWT-22', name: 'The Diversity of Ageing', lng: 0.2, lat: 0.9, number: '22' }
  ];

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
      },
      center: [0.1, 0.6],
      zoom: 13,
      bearing: 0,
      pitch: 0,
      maxBounds: [[-1.2, -0.8], [1.5, 2.0]]
    });

    map.current.on('load', () => {
      // Add floor plan as a source
      map.current.addSource('floor-plan', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            // Science of Ageing gallery - angular/pentagon shape matching reference
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-1.0, -0.5],   // Bottom left
                  [1.2, -0.5],    // Bottom right
                  [1.2, 0.8],     // Right wall up
                  [1.2, 1.3],     // Right corner
                  [0.8, 1.7],     // Top right angled
                  [0.2, 1.7],     // Top edge
                  [-0.4, 1.3],    // Top left angled
                  [-1.0, 0.8],    // Left wall down
                  [-1.0, -0.5]    // Close polygon
                ]]
              },
              properties: {
                type: 'gallery',
                name: 'Science of Ageing Gallery'
              }
            },
            // Exhibition paths and walkways
            {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-0.9, -0.4],
                  [1.1, -0.4],
                  [1.1, -0.2],
                  [-0.9, -0.2],
                  [-0.9, -0.4]
                ]]
              },
              properties: {
                type: 'walkway',
                name: 'Main Entrance Path'
              }
            }
          ]
        }
      });

      // Add floor plan layer
      map.current.addLayer({
        id: 'floor-plan-fill',
        type: 'fill',
        source: 'floor-plan',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'type'], 'walkway'], '#FFB347',
            ['==', ['get', 'type'], 'gallery'], '#E8F4FD',
            '#F5F5F5'
          ],
          'fill-opacity': 0.3
        }
      });

      map.current.addLayer({
        id: 'floor-plan-outline',
        type: 'line',
        source: 'floor-plan',
        paint: {
          'line-color': '#4A5568',
          'line-width': 3,
          'line-opacity': 0.8
        }
      });

      // Add exhibits as markers
      addExhibitMarkers();

      // Add navigation path if current exhibit exists
      if (currentExhibit) {
        addNavigationPath();
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when current exhibit changes
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      updateMarkers();
      updateNavigationPath();
    }
  }, [currentExhibit]);

  const addExhibitMarkers = () => {
    dwtExhibits.forEach(exhibit => {
      const el = createMarkerElement(exhibit);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([exhibit.lng, exhibit.lat])
        .addTo(map.current);

      // Add click event
      el.addEventListener('click', () => handleExhibitClick(exhibit));
    });
  };

  const createMarkerElement = (exhibit) => {
    const isActive = currentExhibit && exhibit.id === currentExhibit.id;
    const nextExhibit = getNextExhibit();
    const isNext = nextExhibit && exhibit.id === nextExhibit.id;

    const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
    const size = isActive ? 35 : isNext ? 30 : 25;

    const el = document.createElement('div');
    el.className = 'dwt-marker';
    el.style.cssText = `
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
      cursor: pointer;
      transform: translate(-50%, -50%);
      z-index: 1000;
      ${isActive ? 'animation: pulse 2s infinite;' : ''}
    `;

    el.innerHTML = exhibit.number;

    // Add CSS for pulse animation
    if (isActive && !document.getElementById('marker-animation-css')) {
      const style = document.createElement('style');
      style.id = 'marker-animation-css';
      style.textContent = `
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    return el;
  };

  const updateMarkers = () => {
    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.dwt-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Re-add updated markers
    addExhibitMarkers();
  };

  const getNextExhibit = () => {
    if (!currentExhibit) return null;
    const currentIndex = dwtExhibits.findIndex(exhibit => exhibit.id === currentExhibit.id);
    if (currentIndex === -1) return null;
    const nextIndex = currentIndex + 1 < dwtExhibits.length ? currentIndex + 1 : 0;
    return dwtExhibits[nextIndex];
  };

  const addNavigationPath = () => {
    const currentExhibitData = dwtExhibits.find(exhibit => exhibit.id === currentExhibit?.id);
    const nextExhibit = getNextExhibit();

    if (currentExhibitData && nextExhibit) {
      map.current.addSource('navigation-path', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [currentExhibitData.lng, currentExhibitData.lat],
              [nextExhibit.lng, nextExhibit.lat]
            ]
          }
        }
      });

      map.current.addLayer({
        id: 'navigation-path',
        type: 'line',
        source: 'navigation-path',
        paint: {
          'line-color': '#FF4757',
          'line-width': 4,
          'line-dasharray': [2, 2]
        }
      });
    }
  };

  const updateNavigationPath = () => {
    if (map.current.getSource('navigation-path')) {
      map.current.removeLayer('navigation-path');
      map.current.removeSource('navigation-path');
    }
    addNavigationPath();
  };

  const handleExhibitClick = (exhibit) => {
    setSelectedExhibit(exhibit);
    if (onExhibitSelect) {
      onExhibitSelect({
        id: exhibit.id,
        name: exhibit.name,
        zone: 'DWT',
        lng: exhibit.lng,
        lat: exhibit.lat
      });
    }
  };

  return (
    <div style={{
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
              Interactive Floor Plan • MapLibre GL JS
            </p>
          </div>
          {currentExhibit && (
            <div style={{
              textAlign: 'right',
              fontSize: '14px',
              background: 'rgba(255,255,255,0.15)',
              padding: '12px 16px',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>
                📍 {currentExhibit.name}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MapLibre Map */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '0 0 16px 16px'
      }}>
        <div
          ref={mapContainer}
          style={{
            height: '400px',
            width: '100%',
            borderRadius: '12px',
            border: '2px solid #E5E7EB'
          }}
        />

        {/* Legend */}
        <div style={{
          marginTop: '15px',
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          fontSize: '12px',
          color: '#666'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#4285F4'
            }}></div>
            Current
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#FF4757'
            }}></div>
            Next
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#8E44AD'
            }}></div>
            Exhibit
          </div>
        </div>

        {/* Exhibit Count */}
        <div style={{
          marginTop: '10px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666',
          fontWeight: '600'
        }}>
          📊 {dwtExhibits.length} Exhibits Total
        </div>

        {/* Selected exhibit info */}
        {selectedExhibit && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            background: '#F3F4F6',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 5px 0', color: '#8E44AD' }}>
              {selectedExhibit.id}
            </h4>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
              {selectedExhibit.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DWTMapLibreMap;