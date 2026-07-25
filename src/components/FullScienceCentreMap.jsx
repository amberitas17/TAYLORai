import React, { useState } from 'react';

const FullScienceCentreMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // DWT exhibits positioned exactly as shown in the original reference map
  const dwtExhibits = [
    // Bottom row - left to right as shown in original (01-10)
    { id: 'DWT-01', name: 'Entrance Statement', x: 320, y: 340, number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', x: 345, y: 340, number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', x: 370, y: 340, number: '03' },
    { id: 'DWT-04', name: 'Brain', x: 395, y: 340, number: '04' },
    { id: 'DWT-05', name: 'Reaction Time Game', x: 420, y: 340, number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', x: 445, y: 340, number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', x: 470, y: 340, number: '07' },
    { id: 'DWT-08', name: 'Puberty', x: 495, y: 340, number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', x: 520, y: 340, number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', x: 545, y: 340, number: '10' },

    // Right wall going up (11-17)
    { id: 'DWT-11', name: 'Did You Know?', x: 545, y: 315, number: '11' },
    { id: 'DWT-12', name: 'Cell Division', x: 545, y: 290, number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', x: 545, y: 265, number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', x: 545, y: 240, number: '14' },
    { id: 'DWT-15', name: 'Tremor', x: 545, y: 215, number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', x: 545, y: 190, number: '16' },
    { id: 'DWT-17', name: 'Mobility', x: 545, y: 165, number: '17' },

    // Top row going left (18-20)
    { id: 'DWT-18', name: 'Hearing', x: 520, y: 140, number: '18' },
    { id: 'DWT-19', name: 'Vision', x: 495, y: 115, number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', x: 470, y: 115, number: '20' },

    // Interior exhibits (21-22)
    { id: 'DWT-21', name: 'Retirement Bench', x: 420, y: 260, number: '21' },
    { id: 'DWT-22', name: 'The Diversity of Ageing', x: 445, y: 190, number: '22' }
  ];

  const getNextExhibit = () => {
    if (!currentExhibit) return null;
    const currentIndex = dwtExhibits.findIndex(exhibit => exhibit.id === currentExhibit.id);
    if (currentIndex === -1) return null;
    const nextIndex = currentIndex + 1 < dwtExhibits.length ? currentIndex + 1 : 0;
    return dwtExhibits[nextIndex];
  };

  const handleExhibitClick = (exhibit) => {
    setSelectedExhibit(exhibit);
    if (onExhibitSelect) {
      onExhibitSelect({
        id: exhibit.id,
        name: exhibit.name,
        zone: 'DWT'
      });
    }
  };

  const currentExhibitData = currentExhibit ?
    dwtExhibits.find(exhibit => exhibit.id === currentExhibit.id) : null;
  const nextExhibit = getNextExhibit();

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
              Singapore Science Centre
            </h2>
            <p style={{
              margin: '6px 0 0 0',
              fontSize: '15px',
              opacity: 0.95,
              fontWeight: '500'
            }}>
              Complete Floor Plan • All Zones
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

      {/* SVG Map */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '0 0 16px 16px'
      }}>
        <svg
          width="600"
          height="500"
          viewBox="0 0 600 500"
          style={{
            border: '2px solid #E5E7EB',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            height: 'auto',
            background: '#F8FAFC'
          }}
        >
          {/* Full Singapore Science Centre Floor Plan */}

          {/* Pink Zone (top left) */}
          <path
            d="M 50 50
               L 50 150
               L 200 150
               L 200 50
               Z"
            fill="rgba(255, 192, 203, 0.3)"
            stroke="#E91E63"
            strokeWidth="2"
          />
          <text x="125" y="100" textAnchor="middle" fill="#E91E63" fontSize="14" fontWeight="bold">
            Pink Zone
          </text>

          {/* Yellow Zone (top right) */}
          <path
            d="M 350 50
               L 350 150
               L 550 150
               L 550 50
               Z"
            fill="rgba(255, 255, 0, 0.3)"
            stroke="#FFC107"
            strokeWidth="2"
          />
          <text x="450" y="100" textAnchor="middle" fill="#FF8F00" fontSize="14" fontWeight="bold">
            Yellow Zone
          </text>

          {/* Main Central Area */}
          <path
            d="M 50 180
               L 50 280
               L 300 280
               L 300 180
               Z"
            fill="rgba(158, 158, 158, 0.1)"
            stroke="#9E9E9E"
            strokeWidth="2"
          />

          {/* Science of Ageing Area (irregular hexagonal shape) */}
          <path
            d="M 300 280
               L 300 350
               L 520 350
               L 540 330
               L 540 280
               L 520 260
               L 500 240
               L 480 220
               L 460 200
               L 440 180
               L 420 160
               L 400 140
               L 380 120
               L 360 100
               L 340 120
               L 320 140
               L 300 160
               Z"
            fill="rgba(142, 68, 173, 0.15)"
            stroke="#8E44AD"
            strokeWidth="3"
          />

          {/* Science of Ageing Label */}
          <text x="420" y="250" textAnchor="middle" fill="#8E44AD" fontSize="16" fontWeight="bold">
            Science of
          </text>
          <text x="420" y="270" textAnchor="middle" fill="#8E44AD" fontSize="16" fontWeight="bold">
            Ageing
          </text>

          {/* Additional building sections */}
          <path
            d="M 50 310
               L 50 450
               L 250 450
               L 250 310
               Z"
            fill="rgba(158, 158, 158, 0.1)"
            stroke="#9E9E9E"
            strokeWidth="2"
          />

          {/* Navigation path */}
          {currentExhibitData && nextExhibit && (
            <line
              x1={currentExhibitData.x}
              y1={currentExhibitData.y}
              x2={nextExhibit.x}
              y2={nextExhibit.y}
              stroke="#FF4757"
              strokeWidth="3"
              strokeDasharray="8,4"
              opacity="0.8"
            />
          )}

          {/* DWT Exhibit markers */}
          {dwtExhibits.map((exhibit) => {
            const isActive = currentExhibitData && exhibit.id === currentExhibitData.id;
            const isNext = nextExhibit && exhibit.id === nextExhibit.id;

            const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
            const radius = isActive ? 15 : isNext ? 12 : 10;

            return (
              <g key={exhibit.id}>
                {/* Drop shadow */}
                <circle
                  cx={exhibit.x + 1}
                  cy={exhibit.y + 1}
                  r={radius}
                  fill="rgba(0,0,0,0.2)"
                />

                {/* Main circle */}
                <circle
                  cx={exhibit.x}
                  cy={exhibit.y}
                  r={radius}
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                  style={{
                    cursor: 'pointer',
                    filter: isActive ? 'brightness(1.1)' : 'none'
                  }}
                  onClick={() => handleExhibitClick(exhibit)}
                />

                {/* Pulse animation for active exhibit */}
                {isActive && (
                  <circle
                    cx={exhibit.x}
                    cy={exhibit.y}
                    r={radius + 3}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      values={`${radius + 3};${radius + 6};${radius + 3}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0.2;0.6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Exhibit number */}
                <text
                  x={exhibit.x}
                  y={exhibit.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={radius > 12 ? "10" : "8"}
                  fontWeight="bold"
                  fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleExhibitClick(exhibit)}
                >
                  {exhibit.number}
                </text>
              </g>
            );
          })}

          {/* Building outline */}
          <path
            d="M 40 40
               L 40 460
               L 560 460
               L 560 40
               Z"
            fill="none"
            stroke="#424242"
            strokeWidth="3"
            strokeDasharray="10,5"
          />

          {/* Main title */}
          <text
            x="300"
            y="30"
            textAnchor="middle"
            fill="#424242"
            fontSize="18"
            fontWeight="bold"
            fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
          >
            Singapore Science Centre Floor Plan
          </text>
        </svg>

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
            DWT Exhibit
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: 'rgba(255, 192, 203, 0.5)',
              border: '1px solid #E91E63'
            }}></div>
            Pink Zone
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: 'rgba(255, 255, 0, 0.5)',
              border: '1px solid #FFC107'
            }}></div>
            Yellow Zone
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
          📊 {dwtExhibits.length} DWT Exhibits in Full Building Context
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

export default FullScienceCentreMap;