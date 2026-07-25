import React, { useState } from 'react';

const DWTReferenceMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // DWT exhibits positioned exactly as shown in the reference floor plan image
  const dwtExhibits = [
    // Bottom corridor spanning the full width (01-10)
    { id: 'DWT-01', name: 'Entrance Statement', x: 110, y: 340, number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', x: 145, y: 340, number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', x: 180, y: 340, number: '03' },
    { id: 'DWT-04', name: 'Brain', x: 215, y: 340, number: '04' },
    { id: 'DWT-05', name: 'Reaction Time Game', x: 250, y: 340, number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', x: 285, y: 340, number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', x: 320, y: 340, number: '07' },
    { id: 'DWT-08', name: 'Puberty', x: 355, y: 340, number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', x: 390, y: 340, number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', x: 425, y: 340, number: '10' },

    // Right angled corridor following the pentagon shape (11-20)
    { id: 'DWT-11', name: 'Did You Know?', x: 440, y: 300, number: '11' },
    { id: 'DWT-12', name: 'Cell Division', x: 445, y: 260, number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', x: 445, y: 220, number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', x: 445, y: 180, number: '14' },
    { id: 'DWT-15', name: 'Tremor', x: 445, y: 140, number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', x: 445, y: 100, number: '16' },
    { id: 'DWT-17', name: 'Mobility', x: 445, y: 60, number: '17' },
    { id: 'DWT-18', name: 'Hearing', x: 440, y: 40, number: '18' },
    { id: 'DWT-19', name: 'Vision', x: 400, y: 40, number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', x: 360, y: 40, number: '20' },

    // Interior exhibits (21-22) as shown in the image
    { id: 'DWT-21', name: 'Retirement Bench', x: 280, y: 200, number: '21' },
    { id: 'DWT-22', name: 'The Diversity of Ageing', x: 350, y: 120, number: '22' }
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
              Science of Ageing
            </h2>
            <p style={{
              margin: '6px 0 0 0',
              fontSize: '15px',
              opacity: 0.95,
              fontWeight: '500'
            }}>
              Pentagon Angular Shape • Reference Map
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
          width="500"
          height="400"
          viewBox="0 0 500 400"
          style={{
            border: '2px solid #E5E7EB',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            height: 'auto',
            background: '#F8FAFC'
          }}
        >
          {/* Irregular hexagonal gallery shape matching the full floor plan context */}
          <path
            d="M 60 300
               L 60 370
               L 420 370
               L 420 320
               L 460 280
               L 480 240
               L 480 20
               L 440 20
               L 440 160
               L 400 200
               L 360 240
               L 320 260
               L 280 280
               L 200 300
               Z"
            fill="rgba(142, 68, 173, 0.15)"
            stroke="#8E44AD"
            strokeWidth="3"
          />

          {/* Interior space outline */}
          <path
            d="M 120 60
               L 120 300
               L 380 300
               L 410 270
               L 430 250
               L 430 60
               Z"
            fill="rgba(142, 68, 173, 0.05)"
            stroke="#8E44AD"
            strokeWidth="1"
            strokeDasharray="5,5"
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

          {/* Exhibit markers */}
          {dwtExhibits.map((exhibit) => {
            const isActive = currentExhibitData && exhibit.id === currentExhibitData.id;
            const isNext = nextExhibit && exhibit.id === nextExhibit.id;

            const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
            const radius = isActive ? 18 : isNext ? 15 : 12;

            return (
              <g key={exhibit.id}>
                {/* Drop shadow */}
                <circle
                  cx={exhibit.x + 2}
                  cy={exhibit.y + 2}
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
                  strokeWidth="3"
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
                    r={radius + 5}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      values={`${radius + 5};${radius + 10};${radius + 5}`}
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
                  fontSize={radius > 15 ? "12" : "10"}
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

          {/* Zone label */}
          <text
            x="250"
            y="25"
            textAnchor="middle"
            fill="#8E44AD"
            fontSize="16"
            fontWeight="bold"
            fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
          >
            Science of Ageing Gallery
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

export default DWTReferenceMap;