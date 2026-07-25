import React, { useState, useEffect } from 'react';

// Modern interactive map inspired by the reference design
const FloorPlanMap = ({ zone = 'DWT', currentExhibit = null, onExhibitSelect = null }) => {
  const [hoveredExhibit, setHoveredExhibit] = useState(null);

  // Zone data with modern flat design styling matching your floor plan requirements
  const zoneExhibits = {
    DWT: {
      name: 'Science of Ageing',
      color: '#8B5A87', // Purple theme inspired by reference
      bgColor: '#F3F0F2',
      borderColor: '#6B4069',
      accentColor: '#B47EB8',
      exhibits: [
        // Science of Ageing exhibits positioned according to floor plan
        // Lower corridor (horizontal section)
        { id: 'DWT-01', name: 'Entrance Statement', position: { x: 340, y: 310 }, number: '01' },
        { id: 'DWT-02', name: 'Kopi Talk', position: { x: 370, y: 310 }, number: '02' },
        { id: 'DWT-03', name: 'Experiencing Dementia', position: { x: 400, y: 310 }, number: '03' },
        { id: 'DWT-04', name: 'Brain', position: { x: 430, y: 310 }, number: '04' },
        { id: 'DWT-05', name: 'Reaction Time Game', position: { x: 430, y: 280 }, number: '05' },
        { id: 'DWT-06', name: 'Bones and Joints', position: { x: 430, y: 250 }, number: '06' },
        { id: 'DWT-07', name: 'Cell Ageing', position: { x: 430, y: 220 }, number: '07' },
        { id: 'DWT-08', name: 'Puberty', position: { x: 430, y: 190 }, number: '08' },
        { id: 'DWT-09', name: 'Circulatory System', position: { x: 430, y: 160 }, number: '09' },
        { id: 'DWT-10', name: 'Skin Ageing', position: { x: 430, y: 130 }, number: '10' },
        // Upper section (around the circular area)
        { id: 'DWT-11', name: 'Did You Know?', position: { x: 400, y: 100 }, number: '11' },
        { id: 'DWT-12', name: 'Cell Division', position: { x: 370, y: 90 }, number: '12' },
        { id: 'DWT-13', name: 'Cell Growth', position: { x: 340, y: 90 }, number: '13' },
        { id: 'DWT-14', name: 'Sense of Balance', position: { x: 310, y: 100 }, number: '14' },
        { id: 'DWT-15', name: 'Tremor', position: { x: 280, y: 120 }, number: '15' },
        { id: 'DWT-16', name: 'Complex Tasks', position: { x: 260, y: 150 }, number: '16' },
        { id: 'DWT-17', name: 'Mobility', position: { x: 250, y: 180 }, number: '17' },
        { id: 'DWT-18', name: 'Hearing', position: { x: 250, y: 210 }, number: '18' },
        { id: 'DWT-19', name: 'Vision', position: { x: 260, y: 240 }, number: '19' },
        { id: 'DWT-20', name: 'Hand-Eye Coordination', position: { x: 280, y: 270 }, number: '20' },
        { id: 'DWT-21', name: 'Retirement Bench', position: { x: 310, y: 290 }, number: '21' },
        { id: 'DWT-22', name: 'The Diversity of Ageing', position: { x: 340, y: 280 }, number: '22' }
      ]
    },
    EAP: {
      name: 'Earth & Planetary Sciences',
      color: '#2E8B57', // Sea green theme
      bgColor: '#F0F8F5',
      borderColor: '#1F5F3F',
      accentColor: '#4A9B6B',
      exhibits: [
        // Pink Zone exhibits (top left)
        { id: 'EAP-22', name: 'Climate Action', position: { x: 120, y: 80 }, number: '22', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-23', name: 'Future Oceans', position: { x: 160, y: 60 }, number: '23', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-24', name: 'Arctic Changes', position: { x: 200, y: 80 }, number: '24', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-01', name: 'Earth Alive', position: { x: 140, y: 120 }, number: '01', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-03', name: 'Bend the Carbon Curve', position: { x: 180, y: 140 }, number: '03', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-04', name: 'Climate Chat', position: { x: 220, y: 120 }, number: '04', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-05', name: 'Freeloader', position: { x: 160, y: 160 }, number: '05', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-07', name: 'Disaster Teamwork', position: { x: 200, y: 180 }, number: '07', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-08', name: 'Survivor Stories', position: { x: 120, y: 180 }, number: '08', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-09', name: 'Typhoon Simulator', position: { x: 100, y: 140 }, number: '09', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-10', name: 'Condensation and Evaporation', position: { x: 80, y: 100 }, number: '10', zone: 'Pink', zoneBg: '#FFB6C1' },
        { id: 'EAP-11', name: 'Rain and Terrain', position: { x: 100, y: 200 }, number: '11', zone: 'Pink', zoneBg: '#FFB6C1' },

        // Yellow Zone exhibits (top right)
        { id: 'EAP-25', name: 'Soil Science', position: { x: 380, y: 60 }, number: '25', zone: 'Yellow', zoneBg: '#FFE135' },
        { id: 'EAP-26', name: 'Rock Cycle', position: { x: 420, y: 80 }, number: '26', zone: 'Yellow', zoneBg: '#FFE135' },
        { id: 'EAP-16', name: 'Swirling Storms', position: { x: 360, y: 100 }, number: '16', zone: 'Yellow', zoneBg: '#FFE135' },
        { id: 'EAP-17', name: 'Sandflow', position: { x: 400, y: 120 }, number: '17', zone: 'Yellow', zoneBg: '#FFE135' },
        { id: 'EAP-18', name: 'Atmosphere Hydrosphere', position: { x: 440, y: 100 }, number: '18', zone: 'Yellow', zoneBg: '#FFE135' },
        { id: 'EAP-19', name: 'Building for Quakes', position: { x: 380, y: 140 }, number: '19', zone: 'Yellow', zoneBg: '#FFE135' },
        { id: 'EAP-20', name: 'Un-solid Ground', position: { x: 420, y: 160 }, number: '20', zone: 'Yellow', zoneBg: '#FFE135' },
        { id: 'EAP-21', name: 'Seeing Earth', position: { x: 360, y: 180 }, number: '21', zone: 'Yellow', zoneBg: '#FFE135' },

        // Connecting area exhibits
        { id: 'EAP-27', name: 'Measuring Quakes', position: { x: 280, y: 220 }, number: '27', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-28', name: 'Shaking Waves', position: { x: 250, y: 200 }, number: '28', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-29', name: 'GeoSphere', position: { x: 300, y: 180 }, number: '29', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-30', name: 'Earth-quake', position: { x: 320, y: 160 }, number: '30', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-31', name: 'Folded Rocks', position: { x: 260, y: 260 }, number: '31', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-32', name: 'Rock Slices', position: { x: 240, y: 280 }, number: '32', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-33', name: 'Singapore Rocks', position: { x: 280, y: 300 }, number: '33', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-34', name: 'Microfossils', position: { x: 320, y: 280 }, number: '34', zone: 'Central', zoneBg: '#87CEEB' },
        { id: 'EAP-35', name: 'Volcano', position: { x: 300, y: 240 }, number: '35', zone: 'Central', zoneBg: '#87CEEB' }
      ]
    }
  };

  const zoneData = zoneExhibits[zone];
  if (!zoneData) return null;

  // Modern navigation path with smooth curves
  const createModernPath = (from, to) => {
    if (!from || !to) return '';

    const fromX = from.position.x;
    const fromY = from.position.y;
    const toX = to.position.x;
    const toY = to.position.y;

    // Create smooth curved path
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const controlX1 = fromX + deltaX * 0.3;
    const controlY1 = fromY;
    const controlX2 = fromX + deltaX * 0.7;
    const controlY2 = toY;

    return `M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`;
  };

  const getNextExhibit = (currentExhibitId) => {
    if (!currentExhibitId) return null;
    const currentIndex = zoneData.exhibits.findIndex(exhibit => exhibit.id === currentExhibitId);
    if (currentIndex === -1) return null;
    const nextIndex = currentIndex + 1 < zoneData.exhibits.length ? currentIndex + 1 : 0;
    return zoneData.exhibits[nextIndex];
  };

  const nextExhibit = currentExhibit ? getNextExhibit(currentExhibit.id) : null;
  const currentExhibitData = currentExhibit ?
    zoneData.exhibits.find(exhibit => exhibit.id === currentExhibit.id) : null;

  const navigationPath = (currentExhibitData && nextExhibit) ?
    createModernPath(currentExhibitData, nextExhibit) : '';

  const handleExhibitClick = (exhibit) => {
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
    <div style={{
      height: '600px',
      width: '100%',
      backgroundColor: '#F8FAFC',
      borderRadius: '24px',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      border: '1px solid rgba(255,255,255,0.2)'
    }}>
      {/* Premium header with glassmorphism effect */}
      <div style={{
        padding: '24px 28px',
        background: zone === 'DWT'
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="1"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.3
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: '700',
              letterSpacing: '-0.025em',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {zone === 'DWT' ? 'Science of Ageing' : 'Earth & Planetary Sciences'}
            </h2>
            <p style={{
              margin: '6px 0 0 0',
              fontSize: '15px',
              opacity: 0.95,
              fontWeight: '500'
            }}>
              Singapore Science Centre
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
              <div style={{ fontWeight: '600', fontSize: '15px' }}>📍 {currentExhibit.name}</div>
              {nextExhibit && (
                <div style={{ opacity: 0.9, marginTop: '4px', fontSize: '13px' }}>
                  → {nextExhibit.name}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive map */}
      <svg
        width="100%"
        height="520"
        viewBox="0 0 500 400"
        style={{
          background: zone === 'DWT'
            ? 'linear-gradient(45deg, #e3f2fd 0%, #f3e5f5 50%, #fce4ec 100%)'
            : 'linear-gradient(45deg, #e8f5e8 0%, #fff3e0 50%, #fce4ec 100%)'
        }}
      >
        <defs>
          {/* Enhanced shadows and effects */}
          <filter id="modernShadow">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.15"/>
          </filter>
          <filter id="premiumGlow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="innerShadow">
            <feOffset dx="0" dy="1"/>
            <feGaussianBlur stdDeviation="2" result="offset-blur"/>
            <feFlood flood-color="#000000" flood-opacity="0.1"/>
            <feComposite in2="offset-blur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Vibrant gradients */}
          <linearGradient id="zoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor: zone === 'DWT' ? '#8E44AD' : '#E74C3C'}}/>
            <stop offset="100%" style={{stopColor: zone === 'DWT' ? '#3498DB' : '#F39C12'}}/>
          </linearGradient>
          <radialGradient id="centralGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{stopColor: 'rgba(255,255,255,0.3)'}}/>
            <stop offset="100%" style={{stopColor: 'rgba(255,255,255,0)'}}/>
          </radialGradient>
        </defs>

        {/* Zone backgrounds */}
        {zone === 'DWT' && (
          <g>
            {/* L-shaped Science of Ageing area with vibrant styling */}
            {/* Horizontal corridor (bottom section) */}
            <rect
              x="240"
              y="270"
              width="220"
              height="60"
              rx="20"
              fill="url(#zoneGradient)"
              opacity="0.25"
              filter="url(#modernShadow)"
            />
            <rect
              x="245"
              y="275"
              width="210"
              height="50"
              rx="15"
              fill="rgba(255,255,255,0.4)"
              filter="url(#innerShadow)"
            />

            {/* Vertical corridor (right section) */}
            <rect
              x="410"
              y="80"
              width="60"
              height="250"
              rx="20"
              fill="url(#zoneGradient)"
              opacity="0.25"
              filter="url(#modernShadow)"
            />
            <rect
              x="415"
              y="85"
              width="50"
              height="240"
              rx="15"
              fill="rgba(255,255,255,0.4)"
              filter="url(#innerShadow)"
            />

            {/* Upper section (left side) */}
            <rect
              x="240"
              y="80"
              width="200"
              height="150"
              rx="20"
              fill="url(#zoneGradient)"
              opacity="0.2"
              filter="url(#modernShadow)"
            />
            <rect
              x="245"
              y="85"
              width="190"
              height="140"
              rx="15"
              fill="rgba(255,255,255,0.3)"
              filter="url(#innerShadow)"
            />

            {/* Central circular area with premium styling */}
            <circle
              cx="340"
              cy="160"
              r="55"
              fill="url(#zoneGradient)"
              opacity="0.3"
              filter="url(#modernShadow)"
            />
            <circle
              cx="340"
              cy="160"
              r="45"
              fill="url(#centralGlow)"
            />
            <circle
              cx="340"
              cy="160"
              r="35"
              fill="rgba(255,255,255,0.6)"
              filter="url(#innerShadow)"
            />

            {/* Premium text styling */}
            <text
              x="340"
              y="170"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="#2C3E50"
              style={{textShadow: '0 1px 2px rgba(255,255,255,0.8)'}}
            >
              SCIENCE OF
            </text>
            <text
              x="340"
              y="190"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="#2C3E50"
              style={{textShadow: '0 1px 2px rgba(255,255,255,0.8)'}}
            >
              AGEING
            </text>
          </g>
        )}

        {zone === 'EAP' && (
          <g>
            {/* Pink Zone with premium styling */}
            <rect
              x="50"
              y="40"
              width="200"
              height="180"
              rx="25"
              fill="linear-gradient(135deg, #FF6B9D, #FFB6C1)"
              opacity="0.4"
              filter="url(#modernShadow)"
            />
            <rect
              x="55"
              y="45"
              width="190"
              height="170"
              rx="20"
              fill="rgba(255,255,255,0.4)"
              filter="url(#innerShadow)"
            />
            <circle
              cx="150"
              cy="130"
              r="60"
              fill="rgba(255,182,193,0.3)"
              filter="url(#premiumGlow)"
            />
            <text
              x="150"
              y="75"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#C2185B"
              style={{textShadow: '0 1px 2px rgba(255,255,255,0.8)'}}
            >
              PINK ZONE
            </text>

            {/* Yellow Zone with premium styling */}
            <rect
              x="310"
              y="40"
              width="140"
              height="180"
              rx="25"
              fill="linear-gradient(135deg, #FFD54F, #FFEB3B)"
              opacity="0.5"
              filter="url(#modernShadow)"
            />
            <rect
              x="315"
              y="45"
              width="130"
              height="170"
              rx="20"
              fill="rgba(255,255,255,0.4)"
              filter="url(#innerShadow)"
            />
            <circle
              cx="380"
              cy="130"
              r="50"
              fill="rgba(255,235,59,0.3)"
              filter="url(#premiumGlow)"
            />
            <text
              x="380"
              y="75"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#F57F17"
              style={{textShadow: '0 1px 2px rgba(255,255,255,0.8)'}}
            >
              YELLOW ZONE
            </text>

            {/* Central connecting area with premium styling */}
            <rect
              x="50"
              y="240"
              width="400"
              height="90"
              rx="25"
              fill="linear-gradient(135deg, #64B5F6, #81C784)"
              opacity="0.3"
              filter="url(#modernShadow)"
            />
            <rect
              x="55"
              y="245"
              width="390"
              height="80"
              rx="20"
              fill="rgba(255,255,255,0.4)"
              filter="url(#innerShadow)"
            />
            <text
              x="250"
              y="275"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="#1565C0"
              style={{textShadow: '0 1px 2px rgba(255,255,255,0.8)'}}
            >
              EARTH SCIENCES GALLERY
            </text>
          </g>
        )}

        {/* Modern navigation path */}
        {navigationPath && (
          <g>
            <path
              d={navigationPath}
              stroke="#FF4757"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              opacity="0.9"
              filter="url(#glow)"
            >
              <animate
                attributeName="stroke-dasharray"
                values="0,20;20,0"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>

            {/* Modern arrow */}
            {nextExhibit && (
              <circle
                cx={nextExhibit.position.x}
                cy={nextExhibit.position.y - 25}
                r="8"
                fill="#FF4757"
                opacity="0.9"
              >
                <animate
                  attributeName="r"
                  values="8;12;8"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        )}

        {/* Premium exhibit markers */}
        {zoneData.exhibits.map((exhibit) => {
          const isActive = currentExhibit && exhibit.id === currentExhibit.id;
          const isNext = nextExhibit && exhibit.id === nextExhibit.id;
          const isHovered = hoveredExhibit === exhibit.id;

          let markerColor = '#FFFFFF';
          let borderColor = '#2C3E50';
          let textColor = '#2C3E50';
          let size = 28;
          let gradient = 'none';

          if (isActive) {
            markerColor = '#4285F4';
            borderColor = '#FFFFFF';
            textColor = '#FFFFFF';
            size = 34;
            gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
          } else if (isNext) {
            markerColor = '#FF4757';
            borderColor = '#FFFFFF';
            textColor = '#FFFFFF';
            size = 32;
            gradient = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
          } else if (exhibit.zone === 'Pink') {
            borderColor = '#E91E63';
            markerColor = '#FCE4EC';
            gradient = 'linear-gradient(135deg, #FF6B9D 0%, #FFB6C1 100%)';
          } else if (exhibit.zone === 'Yellow') {
            borderColor = '#FF9800';
            markerColor = '#FFF8E1';
            gradient = 'linear-gradient(135deg, #FFD54F 0%, #FFEB3B 100%)';
          } else if (exhibit.zone === 'Central') {
            borderColor = '#2196F3';
            markerColor = '#E3F2FD';
            gradient = 'linear-gradient(135deg, #64B5F6 0%, #81C784 100%)';
          } else {
            // DWT zone styling
            borderColor = '#8E44AD';
            markerColor = '#F8F9FA';
            gradient = 'linear-gradient(135deg, #8E44AD 0%, #3498DB 100%)';
          }

          if (isHovered) {
            size += 4;
          }

          return (
            <g key={exhibit.id}>
              {/* Premium outer glow for active/next */}
              {(isActive || isNext) && (
                <circle
                  cx={exhibit.position.x}
                  cy={exhibit.position.y}
                  r={size / 2 + 8}
                  fill={isActive ? '#4285F4' : '#FF4757'}
                  opacity="0.2"
                  filter="url(#premiumGlow)"
                >
                  <animate
                    attributeName="r"
                    values={`${size/2 + 8};${size/2 + 12};${size/2 + 8}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.2;0.4;0.2"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Premium circular marker with multiple layers */}
              <circle
                cx={exhibit.position.x}
                cy={exhibit.position.y}
                r={size / 2 + 2}
                fill={borderColor}
                opacity="0.3"
                filter="url(#modernShadow)"
              />
              <circle
                cx={exhibit.position.x}
                cy={exhibit.position.y}
                r={size / 2}
                fill={markerColor}
                stroke={borderColor}
                strokeWidth="3"
                style={{ cursor: 'pointer' }}
                filter="url(#modernShadow)"
                onMouseEnter={() => setHoveredExhibit(exhibit.id)}
                onMouseLeave={() => setHoveredExhibit(null)}
                onClick={() => handleExhibitClick(exhibit)}
              >
                {isActive && (
                  <animate
                    attributeName="r"
                    values={`${size/2};${size/2 + 3};${size/2}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>

              {/* Inner highlight circle */}
              <circle
                cx={exhibit.position.x}
                cy={exhibit.position.y - 2}
                r={size / 2 - 6}
                fill="rgba(255,255,255,0.4)"
                style={{ pointerEvents: 'none' }}
              />

              {/* Premium exhibit number */}
              <text
                x={exhibit.position.x}
                y={exhibit.position.y + 5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={textColor}
                style={{
                  pointerEvents: 'none',
                  textShadow: isActive || isNext
                    ? '0 1px 2px rgba(0,0,0,0.3)'
                    : '0 1px 2px rgba(255,255,255,0.8)'
                }}
              >
                {exhibit.number}
              </text>

              {/* Premium tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={exhibit.position.x - 80}
                    y={exhibit.position.y - 65}
                    width="160"
                    height="45"
                    rx="12"
                    fill="linear-gradient(135deg, #1F2937 0%, #374151 100%)"
                    opacity="0.95"
                    filter="url(#modernShadow)"
                  />
                  <rect
                    x={exhibit.position.x - 75}
                    y={exhibit.position.y - 60}
                    width="150"
                    height="35"
                    rx="8"
                    fill="rgba(255,255,255,0.1)"
                    filter="url(#innerShadow)"
                  />
                  <text
                    x={exhibit.position.x}
                    y={exhibit.position.y - 45}
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="700"
                    style={{textShadow: '0 1px 2px rgba(0,0,0,0.5)'}}
                  >
                    {exhibit.id}
                  </text>
                  <text
                    x={exhibit.position.x}
                    y={exhibit.position.y - 30}
                    textAnchor="middle"
                    fill="#E5E7EB"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {exhibit.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Premium legend */}
        <g transform="translate(20, 340)">
          <rect
            width="160"
            height="50"
            rx="15"
            fill="linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)"
            stroke="rgba(226,232,240,0.8)"
            strokeWidth="1"
            filter="url(#modernShadow)"
            style={{backdropFilter: 'blur(10px)'}}
          />
          <rect
            x="2"
            y="2"
            width="156"
            height="46"
            rx="13"
            fill="rgba(255,255,255,0.3)"
            filter="url(#innerShadow)"
          />
          <text x="15" y="20" fontSize="12" fontWeight="700" fill="#1F2937" style={{textShadow: '0 1px 2px rgba(255,255,255,0.8)'}}>
            Navigation Status
          </text>

          {/* Current indicator */}
          <circle cx="25" cy="35" r="8" fill="#4285F4" filter="url(#premiumGlow)"/>
          <circle cx="25" cy="33" r="4" fill="rgba(255,255,255,0.4)"/>
          <text x="40" y="39" fontSize="10" fontWeight="600" fill="#374151">Current</text>

          {/* Next indicator */}
          <circle cx="90" cy="35" r="8" fill="#FF4757" filter="url(#premiumGlow)"/>
          <circle cx="90" cy="33" r="4" fill="rgba(255,255,255,0.4)"/>
          <text x="105" y="39" fontSize="10" fontWeight="600" fill="#374151">Next</text>
        </g>
      </svg>
    </div>
  );
};

export default FloorPlanMap;