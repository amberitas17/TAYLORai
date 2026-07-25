import React, { useRef, useEffect, useState } from 'react';
import { fabric } from 'fabric';

const DWTFabricMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
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

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 600,
      height: 400,
      backgroundColor: '#F8FAFC'
    });

    fabricCanvasRef.current = canvas;

    // Draw floor plan sections using rectangles
    const drawFloorPlan = () => {
      // Right vertical corridor
      const rightCorridor = new fabric.Rect({
        left: 500,
        top: 80,
        width: 50,
        height: 200,
        fill: 'rgba(142, 68, 173, 0.15)',
        stroke: '#8E44AD',
        strokeWidth: 2,
        selectable: false,
        evented: false
      });

      // Bottom horizontal corridor
      const bottomCorridor = new fabric.Rect({
        left: 200,
        top: 300,
        width: 280,
        height: 40,
        fill: 'rgba(142, 68, 173, 0.15)',
        stroke: '#8E44AD',
        strokeWidth: 2,
        selectable: false,
        evented: false
      });

      // Main gallery area
      const mainGallery = new fabric.Rect({
        left: 130,
        top: 30,
        width: 390,
        height: 280,
        fill: 'rgba(142, 68, 173, 0.08)',
        stroke: '#8E44AD',
        strokeWidth: 1,
        selectable: false,
        evented: false
      });

      // Central circle
      const centralCircle = new fabric.Circle({
        left: 280,
        top: 140,
        radius: 30,
        fill: 'rgba(180, 126, 184, 0.2)',
        stroke: '#8E44AD',
        strokeWidth: 2,
        selectable: false,
        evented: false
      });

      canvas.add(mainGallery, rightCorridor, bottomCorridor, centralCircle);
    };

    // Create exhibit markers
    const createExhibitMarker = (exhibit, isActive = false, isNext = false) => {
      const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
      const radius = isActive ? 18 : isNext ? 15 : 12;

      // Create circle marker
      const circle = new fabric.Circle({
        left: exhibit.x - radius,
        top: exhibit.y - radius,
        radius: radius,
        fill: color,
        stroke: 'white',
        strokeWidth: 3,
        shadow: {
          color: 'rgba(0,0,0,0.3)',
          blur: 8,
          offsetX: 0,
          offsetY: 4
        },
        selectable: false,
        hoverCursor: 'pointer'
      });

      // Create text label
      const text = new fabric.Text(exhibit.number, {
        left: exhibit.x,
        top: exhibit.y,
        fontSize: radius > 15 ? 12 : 10,
        fill: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        fontWeight: 'bold',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        selectable: false,
        hoverCursor: 'pointer'
      });

      // Group circle and text
      const group = new fabric.Group([circle, text], {
        left: exhibit.x - radius,
        top: exhibit.y - radius,
        selectable: false,
        hoverCursor: 'pointer'
      });

      // Add click event
      group.on('mousedown', () => {
        handleExhibitClick(exhibit);
      });

      // Add hover effects
      group.on('mouseover', () => {
        circle.set('fill', isActive ? '#1976D2' : isNext ? '#E53935' : '#5E35B1');
        canvas.renderAll();
      });

      group.on('mouseout', () => {
        circle.set('fill', color);
        canvas.renderAll();
      });

      // Store exhibit data in the group
      group.exhibitData = exhibit;

      return group;
    };

    // Draw navigation path
    const drawNavigationPath = (from, to) => {
      const line = new fabric.Line([from.x, from.y, to.x, to.y], {
        stroke: '#FF4757',
        strokeWidth: 3,
        strokeDashArray: [10, 5],
        selectable: false,
        evented: false
      });
      return line;
    };

    // Initial render
    const renderMap = () => {
      canvas.clear();
      drawFloorPlan();

      const currentExhibitData = currentExhibit ?
        dwtExhibits.find(exhibit => exhibit.id === currentExhibit.id) : null;

      // Get next exhibit
      const getNextExhibit = (currentId) => {
        const currentIndex = dwtExhibits.findIndex(exhibit => exhibit.id === currentId);
        if (currentIndex === -1) return null;
        const nextIndex = currentIndex + 1 < dwtExhibits.length ? currentIndex + 1 : 0;
        return dwtExhibits[nextIndex];
      };

      const nextExhibit = currentExhibitData ? getNextExhibit(currentExhibitData.id) : null;

      // Draw navigation path if current and next exist
      if (currentExhibitData && nextExhibit) {
        const path = drawNavigationPath(currentExhibitData, nextExhibit);
        canvas.add(path);
      }

      // Add all exhibit markers
      dwtExhibits.forEach(exhibit => {
        const isActive = currentExhibitData && exhibit.id === currentExhibitData.id;
        const isNext = nextExhibit && exhibit.id === nextExhibit.id;
        const marker = createExhibitMarker(exhibit, isActive, isNext);
        canvas.add(marker);
      });

      canvas.renderAll();
    };

    renderMap();

    // Cleanup
    return () => {
      canvas.dispose();
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
              Interactive Floor Plan • Fabric.js Powered
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
            height: 'auto'
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

export default DWTFabricMap;