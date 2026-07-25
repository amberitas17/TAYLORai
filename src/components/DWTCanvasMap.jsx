import React, { useRef, useEffect, useState } from 'react';

const DWTCanvasMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const canvasRef = useRef(null);
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // DWT exhibit data with exact coordinates for the floor plan
  const dwtExhibits = [
    // Right vertical corridor - exhibits 01-04
    { id: 'DWT-01', name: 'Entrance Statement', x: 520, y: 100, number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', x: 520, y: 150, number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', x: 520, y: 200, number: '03' },
    { id: 'DWT-04', name: 'Brain', x: 520, y: 250, number: '04' },

    // Bottom horizontal corridor - exhibits 05-10
    { id: 'DWT-05', name: 'Reaction Time Game', x: 470, y: 320, number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', x: 420, y: 320, number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', x: 370, y: 320, number: '07' },
    { id: 'DWT-08', name: 'Puberty', x: 320, y: 320, number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', x: 270, y: 320, number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', x: 220, y: 320, number: '10' },

    // Left side and upper area - exhibits 11-22
    { id: 'DWT-11', name: 'Did You Know?', x: 150, y: 280, number: '11' },
    { id: 'DWT-12', name: 'Cell Division', x: 150, y: 230, number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', x: 150, y: 180, number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', x: 150, y: 130, number: '14' },
    { id: 'DWT-15', name: 'Tremor', x: 150, y: 80, number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', x: 200, y: 50, number: '16' },
    { id: 'DWT-17', name: 'Mobility', x: 250, y: 50, number: '17' },
    { id: 'DWT-18', name: 'Hearing', x: 300, y: 50, number: '18' },
    { id: 'DWT-19', name: 'Vision', x: 350, y: 50, number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', x: 400, y: 50, number: '20' },
    { id: 'DWT-21', name: 'Retirement Bench', x: 300, y: 150, number: '21' },
    { id: 'DWT-22', name: 'The Diversity of Ageing', x: 350, y: 180, number: '22' }
  ];

  // Initialize canvas and draw map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const canvasWidth = 600;
    const canvasHeight = 400;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const drawMap = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Set background
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw floor plan sections
      ctx.strokeStyle = '#8E44AD';
      ctx.lineWidth = 2;

      // Right vertical corridor
      ctx.fillStyle = 'rgba(142, 68, 173, 0.15)';
      ctx.fillRect(500, 80, 50, 200);
      ctx.strokeRect(500, 80, 50, 200);

      // Bottom horizontal corridor
      ctx.fillRect(200, 300, 280, 40);
      ctx.strokeRect(200, 300, 280, 40);

      // Main gallery area
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(142, 68, 173, 0.08)';
      ctx.fillRect(130, 30, 390, 280);
      ctx.strokeRect(130, 30, 390, 280);

      // Central circle
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(180, 126, 184, 0.2)';
      ctx.beginPath();
      ctx.arc(310, 170, 30, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Get current and next exhibits
      const currentExhibitData = currentExhibit ?
        dwtExhibits.find(exhibit => exhibit.id === currentExhibit.id) : null;

      const getNextExhibit = (currentId) => {
        const currentIndex = dwtExhibits.findIndex(exhibit => exhibit.id === currentId);
        if (currentIndex === -1) return null;
        const nextIndex = currentIndex + 1 < dwtExhibits.length ? currentIndex + 1 : 0;
        return dwtExhibits[nextIndex];
      };

      const nextExhibit = currentExhibitData ? getNextExhibit(currentExhibitData.id) : null;

      // Draw navigation path
      if (currentExhibitData && nextExhibit) {
        ctx.strokeStyle = '#FF4757';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(currentExhibitData.x, currentExhibitData.y);
        ctx.lineTo(nextExhibit.x, nextExhibit.y);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
      }

      // Draw exhibit markers
      dwtExhibits.forEach(exhibit => {
        const isActive = currentExhibitData && exhibit.id === currentExhibitData.id;
        const isNext = nextExhibit && exhibit.id === nextExhibit.id;

        const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
        const radius = isActive ? 18 : isNext ? 15 : 12;

        // Draw circle with shadow effect
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // Draw circle
        ctx.fillStyle = color;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(exhibit.x, exhibit.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw text
        ctx.fillStyle = 'white';
        ctx.font = `bold ${radius > 15 ? '12px' : '10px'} -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(exhibit.number, exhibit.x, exhibit.y);
      });
    };

    // Handle canvas clicks
    const handleCanvasClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      // Check if click is on any exhibit
      dwtExhibits.forEach(exhibit => {
        const distance = Math.sqrt(
          Math.pow(x - exhibit.x, 2) + Math.pow(y - exhibit.y, 2)
        );

        if (distance <= 20) { // Click tolerance
          handleExhibitClick(exhibit);
        }
      });
    };

    canvas.addEventListener('click', handleCanvasClick);
    drawMap();

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [currentExhibit]);

  const handleExhibitClick = (exhibit) => {
    setSelectedExhibit(exhibit);
    if (onExhibitSelect) {
      onExhibitSelect({
        id: exhibit.id,
        name: exhibit.name,
        zone: 'DWT',
        x: exhibit.x,
        y: exhibit.y
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
              Interactive Floor Plan • HTML5 Canvas
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

      {/* Canvas Map */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '0 0 16px 16px'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            border: '2px solid #E5E7EB',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            height: 'auto',
            cursor: 'pointer'
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

export default DWTCanvasMap;