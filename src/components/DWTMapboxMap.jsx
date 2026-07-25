import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken;
} else {
  console.warn('Mapbox access token is not configured. Set VITE_MAPBOX_ACCESS_TOKEN in your environment.');
}

const DWTMapboxMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // EXACT positioning based on your reference photos
  const dwtExhibits = [
    // Science of Ageing Gallery (01-14) - Following first photo EXACTLY
    // Starting from bottom entrance and moving clockwise around pentagon perimeter
    { id: 'DWT-01', name: 'Entrance Statement', coordinates: [103.73680, 1.33180], number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', coordinates: [103.73720, 1.33180], number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', coordinates: [103.73750, 1.33200], number: '03' },
    { id: 'DWT-04', name: 'Brain', coordinates: [103.73780, 1.33230], number: '04' },
    { id: 'DWT-05', name: 'Reaction Time Game', coordinates: [103.73800, 1.33270], number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', coordinates: [103.73780, 1.33310], number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', coordinates: [103.73740, 1.33340], number: '07' },
    { id: 'DWT-08', name: 'Puberty', coordinates: [103.73700, 1.33360], number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', coordinates: [103.73660, 1.33340], number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', coordinates: [103.73620, 1.33310], number: '10' },
    { id: 'DWT-11', name: 'Did You Know?', coordinates: [103.73600, 1.33270], number: '11' },
    { id: 'DWT-12', name: 'Cell Division', coordinates: [103.73620, 1.33230], number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', coordinates: [103.73660, 1.33200], number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', coordinates: [103.73700, 1.33190], number: '14' },

    // Yellow Zone (15-21) - Following second photo layout exactly
    // Horizontal line across the yellow zone, positioned in the top section
    { id: 'DWT-15', name: 'Tremor', coordinates: [103.73640, 1.33420], number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', coordinates: [103.73680, 1.33420], number: '16' },
    { id: 'DWT-17', name: 'Mobility', coordinates: [103.73720, 1.33420], number: '17' },
    { id: 'DWT-18', name: 'Hearing', coordinates: [103.73760, 1.33420], number: '18' },
    { id: 'DWT-19', name: 'Vision', coordinates: [103.73800, 1.33420], number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', coordinates: [103.73740, 1.33390], number: '20' },
    { id: 'DWT-21', name: 'Retirement Bench', coordinates: [103.73700, 1.33390], number: '21' },

    // Pink Zone (only 22) - Following second photo exactly
    // Far left of the top section in pink zone
    { id: 'DWT-22', name: 'The Diversity of Ageing', coordinates: [103.73600, 1.33420], number: '22' }
  ];

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11', // Light style for indoor mapping
      center: [103.7360, 1.3330], // Singapore Science Centre coordinates
      zoom: 19, // High zoom for indoor detail
      pitch: 0,
      bearing: 0
    });

    map.current.on('load', () => {
      // Add Science of Ageing gallery area - pentagon shape matching reference
      map.current.addSource('science-of-ageing', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [103.7360, 1.3315],  // Bottom left
              [103.7385, 1.3315],  // Bottom right
              [103.7385, 1.3325],  // Right wall up
              [103.7380, 1.3340],  // Top right corner
              [103.7370, 1.3365],  // Top angled
              [103.7355, 1.3365],  // Top left
              [103.7350, 1.3340],  // Left wall angled
              [103.7355, 1.3325],  // Left wall down
              [103.7360, 1.3315]   // Close polygon
            ]]
          },
          properties: {
            name: 'Science of Ageing Gallery'
          }
        }
      });

      map.current.addLayer({
        id: 'science-of-ageing-fill',
        type: 'fill',
        source: 'science-of-ageing',
        paint: {
          'fill-color': '#E8F4FD',
          'fill-opacity': 0.3
        }
      });

      map.current.addLayer({
        id: 'science-of-ageing-line',
        type: 'line',
        source: 'science-of-ageing',
        paint: {
          'line-color': '#8E44AD',
          'line-width': 3
        }
      });

      // Add Yellow Zone - matching second photo layout
      map.current.addSource('yellow-zone', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [103.7360, 1.3340],  // Bottom left
              [103.7385, 1.3340],  // Bottom right
              [103.7385, 1.3350],  // Top right
              [103.7385, 1.3360],  // Extended top right
              [103.7380, 1.3380],  // Top angled
              [103.7370, 1.3390],  // Top center
              [103.7360, 1.3380],  // Top left angled
              [103.7355, 1.3360],  // Extended top left
              [103.7355, 1.3350],  // Top left
              [103.7360, 1.3340]   // Close polygon
            ]]
          },
          properties: {
            name: 'Yellow Zone'
          }
        }
      });

      map.current.addLayer({
        id: 'yellow-zone-fill',
        type: 'fill',
        source: 'yellow-zone',
        paint: {
          'fill-color': '#FFFF99',
          'fill-opacity': 0.3
        }
      });

      // Add Pink Zone - matching second photo layout
      map.current.addSource('pink-zone', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [103.7350, 1.3340],  // Bottom left
              [103.7365, 1.3340],  // Bottom right
              [103.7365, 1.3350],  // Top right
              [103.7365, 1.3360],  // Extended top right
              [103.7360, 1.3380],  // Top angled
              [103.7355, 1.3390],  // Top center
              [103.7350, 1.3380],  // Top left angled
              [103.7345, 1.3360],  // Extended top left
              [103.7345, 1.3350],  // Top left
              [103.7350, 1.3340]   // Close polygon
            ]]
          },
          properties: {
            name: 'Pink Zone'
          }
        }
      });

      map.current.addLayer({
        id: 'pink-zone-fill',
        type: 'fill',
        source: 'pink-zone',
        paint: {
          'fill-color': '#FFB6C1',
          'fill-opacity': 0.3
        }
      });

      // Add exhibit markers
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
      const isActive = currentExhibit && exhibit.id === currentExhibit.id;
      const nextExhibit = getNextExhibit();
      const isNext = nextExhibit && exhibit.id === nextExhibit.id;

      const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
      const size = isActive ? 35 : isNext ? 30 : 25;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'mapbox-marker';
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
        ${isActive ? 'animation: pulse 2s infinite;' : ''}
      `;

      el.innerHTML = exhibit.number;

      // Add click event
      el.addEventListener('click', () => handleExhibitClick(exhibit));

      // Create marker
      new mapboxgl.Marker(el)
        .setLngLat(exhibit.coordinates)
        .addTo(map.current);
    });
  };

  const updateMarkers = () => {
    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapbox-marker');
    existingMarkers.forEach(marker => {
      const parent = marker.parentElement;
      if (parent) parent.remove();
    });

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
              currentExhibitData.coordinates,
              nextExhibit.coordinates
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
        coordinates: exhibit.coordinates
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
              Indoor Floor Plan • Mapbox GL JS
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

      {/* Mapbox Map */}
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

export default DWTMapboxMap;