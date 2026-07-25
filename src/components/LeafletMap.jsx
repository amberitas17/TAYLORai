import React, { useRef, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LeafletMap = ({ currentExhibit = null, onExhibitSelect = null, mapType = 'both', showTestControls = false }) => {
  const [selectedExhibit, setSelectedExhibit] = useState(null);
  const [isDraggingMode, setIsDraggingMode] = useState(false);
  const [exhibitPositions, setExhibitPositions] = useState({});

  // Debug logging
  React.useEffect(() => {
    console.log('🗺️ LeafletMap - currentExhibit:', currentExhibit);
    console.log('🗺️ LeafletMap - mapType:', mapType);
    if (currentExhibit) {
      console.log('🗺️ Current exhibit details:', {
        id: currentExhibit.id,
        name: currentExhibit.name,
        zone: currentExhibit.zone,
        key: currentExhibit.key,
        fullId: `${currentExhibit.zone}-${currentExhibit.id}`
      });

      // Show which exhibits we're trying to match against
      const relevantExhibits = getExhibits().filter(e => e.id.startsWith(currentExhibit.zone));
      console.log('🎯 Available exhibits for zone:', relevantExhibits.map(e => ({id: e.id, number: e.number})));
    }
  }, [currentExhibit, mapType]);

  // Actual Singapore Science Centre building coordinates from OpenStreetMap
  const buildingCoordinates = [
    [1.3433694, 103.7314064],
    [1.3435496, 103.7310244],
    [1.3436485, 103.7309020],
    [1.3439080, 103.7302222],
    [1.3440177, 103.7298334],
    [1.3440963, 103.7293723],
    [1.3441427, 103.7289478],
    [1.3441484, 103.7286399],
    [1.3440505, 103.7286066],
    [1.3439633, 103.7286056],
    [1.3439266, 103.7286350],
    [1.3437905, 103.7288921],
    [1.3436456, 103.7290762],
    [1.3435281, 103.7291624],
    [1.3434713, 103.7292388],
    [1.3434204, 103.7293701],
    [1.3433910, 103.7297834],
    [1.3433127, 103.7300714],
    [1.3432382, 103.7302673],
    [1.3433107, 103.7314407],
    [1.3433694, 103.7314064]
  ];

  // Calculate center of the building
  const centerLat = buildingCoordinates.reduce((sum, coord) => sum + coord[0], 0) / buildingCoordinates.length;
  const centerLng = buildingCoordinates.reduce((sum, coord) => sum + coord[1], 0) / buildingCoordinates.length;
  const buildingCenter = [centerLat, centerLng];

  // DWT exhibits positioned within the building using real coordinates
  const dwtExhibits = [
    // Science of Ageing Gallery - positioned in the main building area
    { id: 'DWT-01', name: 'Entrance Statement', coordinates: [1.3437158, 103.7301166], number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', coordinates: [1.3436944, 103.7300254], number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', coordinates: [1.3435885, 103.7300308], number: '03' },
    { id: 'DWT-04', name: 'Brain', coordinates: [1.3435013, 103.7300241], number: '04' },
    { id: 'DWT-05', name: 'Reaction Time Game', coordinates: [1.3433619, 103.7299973], number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', coordinates: [1.3433793, 103.7299329], number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', coordinates: [1.3434222, 103.7297130], number: '07' },
    { id: 'DWT-08', name: 'Puberty', coordinates: [1.3435107, 103.7296298], number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', coordinates: [1.3435871, 103.7297170], number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', coordinates: [1.3435080, 103.7297103], number: '10' },
    { id: 'DWT-11', name: 'Did You Know?', coordinates: [1.3435228, 103.7297975], number: '11' },
    { id: 'DWT-12', name: 'Cell Division', coordinates: [1.3435885, 103.7298001], number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', coordinates: [1.3435978, 103.7298940], number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', coordinates: [1.3435268, 103.7299248], number: '14' },

    // Yellow Zone - upper area of the building
    { id: 'DWT-15', name: 'Tremor', coordinates: [1.3439129, 103.7299530], number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', coordinates: [1.3438854, 103.7299530], number: '16' },
    { id: 'DWT-17', name: 'Mobility', coordinates: [1.3438854, 103.7299077], number: '17' },
    { id: 'DWT-18', name: 'Hearing', coordinates: [1.3439036, 103.7298704], number: '18' },
    { id: 'DWT-19', name: 'Vision', coordinates: [1.3439310, 103.7298610], number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', coordinates: [1.3439403, 103.7298103], number: '20' },
    { id: 'DWT-21', name: 'Retirement Bench', coordinates: [1.3439403, 103.7297517], number: '21' },

    // Pink Zone - left area of the building
    { id: 'DWT-22', name: 'The Diversity of Ageing', coordinates: [1.3438945, 103.7297597], number: '22' }
  ];

  // EAP exhibits - only those that match available classes
  const eapExhibits = [
    { id: 'EAP-01', name: 'Earth_Alive', coordinates: [1.3441060, 103.7287366], number: '01' },
    { id: 'EAP-03', name: 'Bend_the_Carbon_Curve', coordinates: [1.3440966, 103.7288171], number: '03' },
    { id: 'EAP-04', name: 'Climate_Chat', coordinates: [1.3440416, 103.7287930], number: '04' },
    { id: 'EAP-05', name: 'Freeloader', coordinates: [1.3440751, 103.7288694], number: '05' },
    { id: 'EAP-07', name: 'Disaster_Teamwork', coordinates: [1.3440591, 103.7290934], number: '07' },
    { id: 'EAP-08', name: 'Survivor_stories', coordinates: [1.3440832, 103.7289499], number: '08' },
    { id: 'EAP-09', name: 'Typhoon_Simulator', coordinates: [1.3440215, 103.7289526], number: '09' },
    { id: 'EAP-10', name: 'Condensation_and_Evaporation', coordinates: [1.3438754, 103.7289968], number: '10' },
    { id: 'EAP-11', name: 'Rain_and_Terrain', coordinates: [1.3439210, 103.7290250], number: '11' },
    { id: 'EAP-16', name: 'Swirling_storms', coordinates: [1.3439706, 103.7289204], number: '16' },
    { id: 'EAP-17', name: 'Sandflow', coordinates: [1.3438539, 103.7290411], number: '17' },
    { id: 'EAP-18', name: 'Atmosphere_Hydrosphere', coordinates: [1.3439317, 103.7288828], number: '18' },
    { id: 'EAP-19', name: 'Building_for_Quakes', coordinates: [1.3441020, 103.7291095], number: '19' },
    { id: 'EAP-20', name: 'Un-solid_Ground', coordinates: [1.3438083, 103.7290223], number: '20' },
    { id: 'EAP-21', name: 'Seeing_Earth', coordinates: [1.3438928, 103.7287366], number: '21' },
    { id: 'EAP-27', name: 'Measuring_Quakes', coordinates: [1.3437842, 103.7289445], number: '27' },
    { id: 'EAP-28', name: 'Shaking_Waves', coordinates: [1.3438271, 103.7289673], number: '28' },
    { id: 'EAP-29', name: 'GeoSphere', coordinates: [1.3440001, 103.7286240], number: '29' },
    { id: 'EAP-30', name: 'Earth-quake', coordinates: [1.3439317, 103.7286749], number: '30' },
    { id: 'EAP-31', name: 'Folded_Rocks', coordinates: [1.3437574, 103.7289901], number: '31' },
    { id: 'EAP-32', name: 'Rock_Slices', coordinates: [1.3440121, 103.7290733], number: '32' },
    { id: 'EAP-34', name: 'Microfossils', coordinates: [1.3439652, 103.7290518], number: '34' },
    { id: 'EAP-35', name: 'Volcano', coordinates: [1.3440269, 103.7286964], number: '35' }
  ];

  // Get exhibits based on map type
  const getExhibits = () => {
    switch (mapType) {
      case 'DWT':
        return dwtExhibits;
      case 'EAP':
        return eapExhibits;
      case 'both':
      default:
        return [...dwtExhibits, ...eapExhibits];
    }
  };

  const exhibits = getExhibits();

  // Helper function to get next exhibit for prediction (moved up to avoid hoisting issues)
  const getNextExhibit = () => {
    if (!currentExhibit) return null;

    // Find current exhibit using improved matching logic
    const currentIndex = exhibits.findIndex(exhibit =>
      exhibit.id === currentExhibit.id || // Direct ID match
      (currentExhibit.zone && exhibit.id === `${currentExhibit.zone}-${currentExhibit.id}`) || // Zone + ID match
      (currentExhibit.zone && exhibit.number === currentExhibit.id && exhibit.id.startsWith(currentExhibit.zone)) // Zone + number match
    );

    if (currentIndex === -1) return null;
    const nextIndex = currentIndex + 1 < exhibits.length ? currentIndex + 1 : 0;
    return exhibits[nextIndex];
  };

  // Real-time navigation state (added after exhibits to avoid initialization errors)
  const [userPosition, setUserPosition] = useState([1.3437500, 103.7300000]); // Default center position
  const [isNavigating, setIsNavigating] = useState(false);
  const [distanceToTarget, setDistanceToTarget] = useState(0);
  const [lastMovementTime, setLastMovementTime] = useState(Date.now());

  // Update user position and navigation when AI detects a new exhibit
  React.useEffect(() => {
    if (currentExhibit) {
      // Find the detected exhibit coordinates
      const detectedExhibit = exhibits.find(exhibit =>
        exhibit.id === currentExhibit.id ||
        (currentExhibit.zone && exhibit.id === `${currentExhibit.zone}-${currentExhibit.id}`) ||
        (currentExhibit.zone && exhibit.number === currentExhibit.id && exhibit.id.startsWith(currentExhibit.zone))
      );

      if (detectedExhibit) {
        // User is AT the detected exhibit since they pointed their camera at it
        setUserPosition(detectedExhibit.coordinates);

        // Immediately set up navigation to next exhibit
        const nextExhibit = getNextExhibit();
        if (nextExhibit) {
          const distance = calculateDistance(detectedExhibit.coordinates, nextExhibit.coordinates);
          setDistanceToTarget(distance);
          setIsNavigating(true);
        }
      }
    } else {
      setIsNavigating(false);
    }
  }, [currentExhibit, exhibits]);

  // Calculate distance between two geographic coordinates
  const calculateDistance = (pos1, pos2) => {
    const [lat1, lng1] = pos1;
    const [lat2, lng2] = pos2;
    const latDiff = lat2 - lat1;
    const lngDiff = lng2 - lng1;
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  };

  // Real-time movement detection and navigation tracking
  React.useEffect(() => {
    let motionInterval;
    let trackingInterval;

    // Device motion detection for real movement
    const handleDeviceMotion = (event) => {
      if (!event.accelerationIncludingGravity) return;

      const { x, y, z } = event.accelerationIncludingGravity;
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      // Detect significant movement (walking)
      if (magnitude > 12) {
        const now = Date.now();
        if (now - lastMovementTime > 1000) { // Throttle movement updates to 1 second
          setUserPosition(prevPos => {
            const [lat, lng] = prevPos;
            // Simulate realistic walking movement
            const movement = 0.000003; // Small movement increment
            const newLat = lat + (Math.random() - 0.5) * movement;
            const newLng = lng + (Math.random() - 0.5) * movement;
            return [newLat, newLng];
          });
          setLastMovementTime(now);
        }
      }
    };

    // Fallback: Simulate movement for testing when no device motion
    const simulateMovement = () => {
      if (Math.random() > 0.7) { // 30% chance of movement every 2 seconds
        setUserPosition(prevPos => {
          const [lat, lng] = prevPos;
          const movement = 0.000002;
          const newLat = lat + (Math.random() - 0.5) * movement;
          const newLng = lng + (Math.random() - 0.5) * movement;
          return [newLat, newLng];
        });
      }
    };

    // Real-time distance tracking
    const updateNavigation = () => {
      const nextExhibit = getNextExhibit();
      if (currentExhibit && nextExhibit) {
        const distance = calculateDistance(userPosition, nextExhibit.coordinates);
        setDistanceToTarget(distance);
        setIsNavigating(true);
      } else {
        setIsNavigating(false);
      }
    };

    // Set up device motion if available
    if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', handleDeviceMotion);
    } else {
      // Fallback simulation
      motionInterval = setInterval(simulateMovement, 2000);
    }

    // Real-time tracking updates
    trackingInterval = setInterval(updateNavigation, 1000);

    return () => {
      if (typeof DeviceMotionEvent !== 'undefined') {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
      if (motionInterval) clearInterval(motionInterval);
      if (trackingInterval) clearInterval(trackingInterval);
    };
  }, [userPosition, currentExhibit]);

  // Custom marker icons with numbers
  const createCustomIcon = (exhibitNumber, color, isActive = false, isNext = false) => {
    const size = isActive ? 45 : isNext ? 38 : 28;
    const fontSize = isActive ? '16px' : isNext ? '13px' : '10px';

    const pulseAnimation = isActive ? `
      animation: pulse 2s infinite;
      @keyframes pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 ${color}40; }
        70% { transform: scale(1.1); box-shadow: 0 0 0 10px transparent; }
        100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
      }
    ` : '';

    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <style>
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 ${color}40; }
            70% { transform: scale(1.1); box-shadow: 0 0 0 10px transparent; }
            100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
          }
        </style>
        <div style="
          background-color: ${color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: ${isActive ? '5px' : isNext ? '4px' : '3px'} solid white;
          box-shadow: 0 ${isActive ? '6px 12px' : isNext ? '4px 8px' : '2px 6px'} rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: ${fontSize};
          font-family: Arial, sans-serif;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          ${isActive ? 'animation: pulse 2s infinite;' : ''}
          ${isNext ? 'border-style: dashed;' : ''}
        ">${exhibitNumber}</div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  };

  const getExhibitColor = (exhibit, isActive = false, isNext = false) => {
    if (isActive) {
      return '#00E676'; // Bright green for current/predicted exhibit
    } else if (isNext) {
      return '#FF6D00'; // Bright orange for next exhibit
    } else if (exhibit.id.startsWith('DWT')) {
      return '#9C27B0'; // Purple for other DWT exhibits
    } else {
      return '#2196F3'; // Blue for other EAP exhibits
    }
  };

  const handleExhibitClick = (exhibit) => {
    if (!isDraggingMode) {
      setSelectedExhibit(exhibit);
      if (onExhibitSelect) {
        onExhibitSelect({
          id: exhibit.id,
          name: exhibit.name,
          zone: exhibit.id.startsWith('DWT') ? 'DWT' : 'EAP',
          coordinates: exhibit.coordinates
        });
      }
    }
  };

  const handleMarkerDrag = (exhibit, event) => {
    const newPosition = event.target.getLatLng();
    const newCoordinates = [newPosition.lat, newPosition.lng];

    setExhibitPositions(prev => ({
      ...prev,
      [exhibit.id]: newCoordinates
    }));

    // Log to console for debugging
    console.log(`${exhibit.id} moved to:`, newCoordinates);
  };

  const getExhibitCoordinates = (exhibit) => {
    return exhibitPositions[exhibit.id] || exhibit.coordinates;
  };

  const saveCoordinatesToConsole = () => {
    const allExhibits = getExhibits();
    const updatedExhibits = allExhibits.map(exhibit => ({
      ...exhibit,
      coordinates: getExhibitCoordinates(exhibit)
    }));

    const dwtExhibits = updatedExhibits.filter(e => e.id.startsWith('DWT'));
    const eapExhibits = updatedExhibits.filter(e => e.id.startsWith('EAP'));

    console.log('=== UPDATED DWT EXHIBITS ===');
    console.log('const dwtExhibits = [');
    dwtExhibits.forEach(exhibit => {
      console.log(`  { id: '${exhibit.id}', name: '${exhibit.name}', coordinates: [${exhibit.coordinates[0].toFixed(7)}, ${exhibit.coordinates[1].toFixed(7)}], number: '${exhibit.number}' },`);
    });
    console.log('];');

    console.log('\n=== UPDATED EAP EXHIBITS ===');
    console.log('const eapExhibits = [');
    eapExhibits.forEach(exhibit => {
      console.log(`  { id: '${exhibit.id}', name: '${exhibit.name}', coordinates: [${exhibit.coordinates[0].toFixed(7)}, ${exhibit.coordinates[1].toFixed(7)}], number: '${exhibit.number}' },`);
    });
    console.log('];');

    // Also save to clipboard if possible
    const exportData = {
      dwtExhibits: dwtExhibits.map(e => ({ ...e, coordinates: getExhibitCoordinates(e) })),
      eapExhibits: eapExhibits.map(e => ({ ...e, coordinates: getExhibitCoordinates(e) }))
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      alert('Coordinates copied to clipboard! Also check console for formatted code.');
    } else {
      alert('Coordinates logged to console! Open dev tools to copy the formatted code.');
    }
  };

  return (
    <div style={{
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      background: 'linear-gradient(135deg, #27AE60 0%, #2ECC71 100%)',
      padding: '4px'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, #27AE60 0%, #2ECC71 100%)',
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
              Singapore Science Centre
            </h2>
            <p style={{
              margin: '6px 0 0 0',
              fontSize: '15px',
              opacity: 0.95,
              fontWeight: '500'
            }}>
              OpenStreetMap • Leaflet • {mapType.toUpperCase()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {showTestControls && (
              <>
                {/* Dragging Mode Toggle */}
                <button
                  onClick={() => setIsDraggingMode(!isDraggingMode)}
                  style={{
                    background: isDraggingMode ? '#FF4757' : 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {isDraggingMode ? '🔒 Lock' : '📍 Edit'}
                </button>

                {/* Save Coordinates Button */}
                <button
                  onClick={saveCoordinatesToConsole}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  💾 Save
                </button>

                {/* Test Movement Button */}
                <button
                  onClick={() => {
                    setUserPosition(prevPos => {
                      const [lat, lng] = prevPos;
                      const movement = 0.000005;
                      const newLat = lat + (Math.random() - 0.5) * movement;
                      const newLng = lng + (Math.random() - 0.5) * movement;
                      console.log('🚶 Simulated movement to:', [newLat, newLng]);
                      return [newLat, newLng];
                    });
                  }}
                  style={{
                    background: 'rgba(76, 175, 80, 0.3)',
                    color: 'white',
                    border: '2px solid rgba(76, 175, 80, 0.5)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  🚶 Move
                </button>

                {/* Update Position Button */}
                <button
                  onClick={() => {
                    if (currentExhibit) {
                      // Re-sync position to current detected exhibit
                      const detectedExhibit = exhibits.find(exhibit =>
                        exhibit.id === currentExhibit.id ||
                        (currentExhibit.zone && exhibit.id === `${currentExhibit.zone}-${currentExhibit.id}`) ||
                        (currentExhibit.zone && exhibit.number === currentExhibit.id && exhibit.id.startsWith(currentExhibit.zone))
                      );
                      if (detectedExhibit) {
                        setUserPosition(detectedExhibit.coordinates);
                        console.log('🔄 Position synced to detected exhibit:', detectedExhibit.name);
                      }
                    } else {
                      setUserPosition([1.3437500, 103.7300000]);
                      console.log('🏠 Position reset to center - no exhibit detected');
                    }
                  }}
                  style={{
                    background: 'rgba(255, 152, 0, 0.3)',
                    color: 'white',
                    border: '2px solid rgba(255, 152, 0, 0.5)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  🔄 Sync
                </button>
              </>
            )}


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
      </div>

      {/* Leaflet Map */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '0 0 16px 16px'
      }}>
        <div style={{
          height: '500px',
          width: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid #E5E7EB'
        }}>
          <MapContainer
            center={buildingCenter}
            zoom={18}
            style={{ height: '100%', width: '100%' }}
            minZoom={16}
            maxZoom={20}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Singapore Science Centre Building Outline */}
            <Polygon
              positions={buildingCoordinates}
              fillColor="#FF6B35"
              fillOpacity={0.6}
              color="#FF4500"
              weight={6}
              opacity={1}
              dashArray="10, 5"
              lineCap="round"
              lineJoin="round"
            >
              <Popup>
                <div>
                  <h3>Singapore Science Centre</h3>
                  <p>Interactive science museum with {exhibits.length} exhibits</p>
                </div>
              </Popup>
            </Polygon>

            {/* Exhibit Markers */}
            {exhibits.map((exhibit) => {
              // Improved matching logic to handle different ID formats
              const isActive = currentExhibit && (
                exhibit.id === currentExhibit.id || // Direct ID match
                (currentExhibit.zone && exhibit.id === `${currentExhibit.zone}-${currentExhibit.id}`) || // Zone + ID match
                (currentExhibit.zone && exhibit.number === currentExhibit.id && exhibit.id.startsWith(currentExhibit.zone)) // Zone + number match
              );

              const nextExhibit = getNextExhibit();
              const isNext = nextExhibit && exhibit.id === nextExhibit.id;
              const color = getExhibitColor(exhibit, isActive, isNext);

              // Removed excessive debug logging

              return (
                <Marker
                  key={exhibit.id}
                  position={getExhibitCoordinates(exhibit)}
                  icon={createCustomIcon(exhibit.number, color, isActive, isNext)}
                  draggable={isDraggingMode}
                  eventHandlers={{
                    click: () => handleExhibitClick(exhibit),
                    dragend: (event) => handleMarkerDrag(exhibit, event)
                  }}
                >
                  <Popup>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', color: color }}>
                        {exhibit.id}
                      </h4>
                      <p style={{ margin: 0, fontWeight: '600' }}>
                        {exhibit.name}
                      </p>
                      {isActive && (
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#00E676', fontWeight: 'bold', backgroundColor: '#E8F5E8', padding: '4px 8px', borderRadius: '4px' }}>
                          📍 Current/Predicted Exhibit
                        </p>
                      )}
                      {isNext && (
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#FF6D00', fontWeight: 'bold', backgroundColor: '#FFF3E0', padding: '4px 8px', borderRadius: '4px' }}>
                          🎯 Next Exhibit
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Dynamic Navigation Line - adjusts based on distance and movement */}
            {isNavigating && getNextExhibit() && (
              <Polyline
                positions={[userPosition, getNextExhibit().coordinates]}
                color="#00E676"
                weight={Math.max(3, Math.min(10, 15 - (distanceToTarget * 200000)))} // Thicker when closer
                opacity={Math.max(0.4, Math.min(1, 1.5 - (distanceToTarget * 100000)))} // More opaque when closer
                dashArray={distanceToTarget > 0.00005 ? "15, 10" : "25, 5"} // Different dash pattern based on distance
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* User Position Marker with Real-time Updates */}
            <Marker
              position={userPosition}
              icon={L.divIcon({
                className: 'user-position-marker',
                html: `
                  <div style="
                    background: linear-gradient(135deg, #4CAF50, #8BC34A);
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 4px solid white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    position: relative;
                    ${isNavigating ? 'animation: userPulse 1.2s infinite;' : ''}
                  ">
                    <span style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));">📍</span>
                  </div>
                  ${isNavigating ? `
                    <div style="
                      position: absolute;
                      top: -8px;
                      left: -8px;
                      width: 44px;
                      height: 44px;
                      border: 2px solid #4CAF50;
                      border-radius: 50%;
                      opacity: 0.6;
                      animation: ripple 2s infinite;
                    "></div>
                  ` : ''}
                  <style>
                    @keyframes userPulse {
                      0%, 100% { transform: scale(1); }
                      50% { transform: scale(1.15); }
                    }
                    @keyframes ripple {
                      0% { transform: scale(0.8); opacity: 0.8; }
                      100% { transform: scale(1.5); opacity: 0; }
                    }
                  </style>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              })}
              draggable={isDraggingMode}
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target;
                  const position = marker.getLatLng();
                  setUserPosition([position.lat, position.lng]);
                  console.log('📍 User position manually updated:', [position.lat, position.lng]);
                }
              }}
            >
              <Popup>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#4CAF50' }}>
                    📍 Your Location
                  </h4>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '12px' }}>
                    {currentExhibit ? (
                      <>
                        <span style={{ color: '#00E676' }}>📸 Currently at: {currentExhibit.name}</span><br/>
                        {isNavigating && getNextExhibit() && (
                          <span style={{ color: '#FF6D00' }}>🎯 Next: {getNextExhibit().name} ({(distanceToTarget * 111000).toFixed(1)}m)</span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: '#666' }}>Point camera at exhibit to detect location</span>
                    )}
                  </p>
                  <div style={{
                    marginTop: '8px',
                    fontSize: '10px',
                    color: '#999',
                    borderTop: '1px solid #eee',
                    paddingTop: '5px'
                  }}>
                    🎯 Position updates automatically when AI detects exhibits
                  </div>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        {/* Legend */}
        <div style={{
          marginTop: '15px',
          display: 'flex',
          justifyContent: 'center',
          gap: '15px',
          fontSize: '12px',
          color: '#666',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#00E676',
              border: '3px solid white',
              boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '8px',
              fontWeight: 'bold',
              animation: 'pulse 2s infinite'
            }}>10</div>
            Current/Predicted
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#FF6D00',
              border: '3px dashed white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '7px',
              fontWeight: 'bold'
            }}>11</div>
            Next Exhibit
          </div>
          {(mapType === 'DWT' || mapType === 'both') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#9C27B0',
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '6px',
                fontWeight: 'bold'
              }}>01</div>
              DWT
            </div>
          )}
          {(mapType === 'EAP' || mapType === 'both') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#2196F3',
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '6px',
                fontWeight: 'bold'
              }}>01</div>
              EAP
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
              border: '3px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px'
            }}>📍</div>
            Your Position
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '24px',
              height: '3px',
              background: '#00E676',
              borderRadius: '2px',
              position: 'relative',
              opacity: 0.8
            }}>
              <div style={{
                position: 'absolute',
                top: '-3px',
                right: '-4px',
                width: '0',
                height: '0',
                borderLeft: '8px solid #00E676',
                borderTop: '4px solid transparent',
                borderBottom: '4px solid transparent'
              }}></div>
            </div>
            Navigation Line
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: '#FF6B35',
              opacity: 0.6,
              border: '2px solid #FF4500'
            }}></div>
            Building
          </div>
        </div>

        {/* Exhibit Count and Status */}
        <div style={{
          marginTop: '10px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666',
          fontWeight: '600'
        }}>
          🗺️ {exhibits.length} Exhibits Total • Real Geographic Location
          {isDraggingMode && (
            <div style={{
              marginTop: '5px',
              color: '#FF4757',
              fontWeight: 'bold',
              fontSize: '12px'
            }}>
              🖱️ DRAG MODE ACTIVE - Click and drag markers to reposition
            </div>
          )}
          {isNavigating && getNextExhibit() && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
              color: 'white',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
            }}>
              🎯 REAL-TIME NAVIGATION: {getNextExhibit().name} • {(distanceToTarget * 111000).toFixed(1)}m away
              <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                📱 Move your device to see the line adjust in real-time
              </div>
            </div>
          )}
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
            <h4 style={{ margin: '0 0 5px 0', color: getExhibitColor(selectedExhibit) }}>
              {selectedExhibit.id}
            </h4>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
              {selectedExhibit.name}
            </p>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
              {selectedExhibit.coordinates[0].toFixed(6)}, {selectedExhibit.coordinates[1].toFixed(6)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeafletMap;