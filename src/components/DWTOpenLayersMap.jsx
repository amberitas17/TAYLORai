import React, { useRef, useEffect, useState } from 'react';
import { Map, View, Feature } from 'ol';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Point, Polygon } from 'ol/geom';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import 'ol/ol.css';

const DWTOpenLayersMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const mapElement = useRef();
  const map = useRef();
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // DWT exhibits positioned exactly as shown in PDF reference
  const dwtExhibits = [
    // Science of Ageing Gallery (01-14) - Bottom gray area layout from PDF
    { id: 'DWT-01', name: 'Entrance Statement', coordinates: [400, 120], number: '01' },
    { id: 'DWT-02', name: 'Kopi Talk', coordinates: [350, 140], number: '02' },
    { id: 'DWT-03', name: 'Experiencing Dementia', coordinates: [320, 180], number: '03' },
    { id: 'DWT-04', name: 'Brain', coordinates: [340, 220], number: '04' },
    { id: 'DWT-05', name: 'Reaction Time Game', coordinates: [380, 250], number: '05' },
    { id: 'DWT-06', name: 'Bones and Joints', coordinates: [400, 290], number: '06' },
    { id: 'DWT-07', name: 'Cell Ageing', coordinates: [360, 330], number: '07' },
    { id: 'DWT-08', name: 'Puberty', coordinates: [280, 350], number: '08' },
    { id: 'DWT-09', name: 'Circulatory System', coordinates: [240, 340], number: '09' },
    { id: 'DWT-10', name: 'Skin Ageing', coordinates: [200, 320], number: '10' },
    { id: 'DWT-11', name: 'Did You Know?', coordinates: [180, 280], number: '11' },
    { id: 'DWT-12', name: 'Cell Division', coordinates: [200, 240], number: '12' },
    { id: 'DWT-13', name: 'Cell Growth', coordinates: [240, 200], number: '13' },
    { id: 'DWT-14', name: 'Sense of Balance', coordinates: [280, 180], number: '14' },

    // Yellow Zone (15-21) - TOP section as shown in PDF
    { id: 'DWT-15', name: 'Tremor', coordinates: [450, 450], number: '15' },
    { id: 'DWT-16', name: 'Complex Tasks', coordinates: [410, 440], number: '16' },
    { id: 'DWT-17', name: 'Mobility', coordinates: [370, 430], number: '17' },
    { id: 'DWT-18', name: 'Hearing', coordinates: [330, 450], number: '18' },
    { id: 'DWT-19', name: 'Vision', coordinates: [290, 460], number: '19' },
    { id: 'DWT-20', name: 'Hand-Eye Coordination', coordinates: [350, 470], number: '20' },
    { id: 'DWT-21', name: 'Retirement Bench', coordinates: [390, 480], number: '21' },

    // Pink Zone (only 22) - TOP LEFT as shown in PDF
    { id: 'DWT-22', name: 'The Diversity of Ageing', coordinates: [250, 450], number: '22' }
  ];

  useEffect(() => {
    if (!mapElement.current) return;

    // EXACT SINGAPORE SCIENCE CENTRE FLOOR PLAN from PDF reference

    // Main building outer perimeter - Large irregular angular building
    const buildingPerimeterPolygon = new Feature({
      geometry: new Polygon([[
        // Complex angular building shape from PDF
        [100, 100], // Bottom left corner
        [500, 80],  // Bottom edge angled right
        [550, 120], // Bottom right corner
        [580, 200], // Right wall going up
        [600, 300], // Right upper section
        [590, 400], // Right approaching top
        [570, 500], // Right top section
        [520, 550], // Top right corner
        [450, 580], // Top right angled
        [350, 590], // Top edge right
        [250, 585], // Top center
        [150, 580], // Top center left
        [100, 550], // Top left corner
        [80, 500],  // Left top section
        [70, 400],  // Left approaching top
        [75, 300],  // Left upper section
        [90, 200],  // Left wall
        [100, 100]  // Close to start
      ]]),
      name: 'Building Perimeter'
    });

    // Science of Ageing Gallery - Bottom gray area (main exhibition space)
    const scienceOfAgeingPolygon = new Feature({
      geometry: new Polygon([[
        [150, 120], // Bottom left of gallery
        [480, 110], // Bottom edge of gallery
        [520, 140], // Bottom right corner
        [540, 200], // Right wall of gallery
        [530, 280], // Right upper gallery
        [510, 350], // Gallery top right corner
        [480, 380], // Gallery angled top right
        [420, 400], // Gallery top edge right
        [350, 410], // Gallery top center right
        [280, 405], // Gallery top center
        [220, 400], // Gallery top center left
        [170, 380], // Gallery top left edge
        [140, 350], // Gallery angled top left
        [120, 280], // Gallery top left corner
        [130, 200], // Gallery left upper
        [150, 120]  // Close
      ]]),
      name: 'Science of Ageing Gallery'
    });

    // Yellow Zone - TOP rectangular area from PDF
    const yellowZonePolygon = new Feature({
      geometry: new Polygon([[
        [280, 420], // Bottom left (connects to main gallery)
        [520, 410], // Bottom right
        [540, 440], // Right edge
        [550, 500], // Top right corner
        [530, 540], // Top right angled
        [480, 560], // Top edge right
        [350, 565], // Top center
        [280, 560], // Top left edge
        [260, 520], // Left edge angled
        [270, 460], // Left connection
        [280, 420]  // Close
      ]]),
      name: 'Yellow Zone'
    });

    // Pink Zone - TOP LEFT area from PDF
    const pinkZonePolygon = new Feature({
      geometry: new Polygon([[
        [180, 420], // Bottom right (connects to gallery)
        [280, 420], // Right edge (connects to yellow)
        [270, 460], // Right upper connection
        [260, 520], // Right top connection
        [240, 560], // Top right
        [180, 565], // Top edge
        [140, 540], // Top left corner
        [120, 500], // Left edge
        [130, 440], // Left bottom
        [160, 420], // Bottom left
        [180, 420]  // Close
      ]]),
      name: 'Pink Zone'
    });

    // Left wing corridors and spaces
    const leftWingPolygon = new Feature({
      geometry: new Polygon([[
        [80, 150],  // Connection point
        [150, 120], // Connect to main gallery
        [130, 200], // Gallery left wall
        [120, 280], // Gallery top left
        [100, 350], // Left wing upper
        [90, 420],  // Left wing top
        [80, 500],  // Left top section
        [70, 400],  // Left wall
        [75, 300],  // Left upper
        [90, 200],  // Left middle
        [80, 150]   // Close
      ]]),
      name: 'Left Wing Areas'
    });

    // Right wing corridors and spaces
    const rightWingPolygon = new Feature({
      geometry: new Polygon([[
        [520, 140], // Connect to main gallery
        [580, 120], // Right connection
        [580, 200], // Right wall
        [600, 300], // Right upper
        [590, 400], // Right top approach
        [570, 480], // Right top
        [550, 500], // Connect to yellow zone
        [540, 440], // Yellow zone connection
        [520, 410], // Gallery top connection
        [540, 350], // Gallery right connection
        [540, 280], // Gallery right upper
        [540, 200], // Gallery right wall
        [520, 140]  // Close
      ]]),
      name: 'Right Wing Areas'
    });

    // Top areas above zones
    const topAreasPolygon = new Feature({
      geometry: new Polygon([[
        [100, 550], // Left connection
        [520, 550], // Right connection
        [570, 500], // Right top section connection
        [590, 400], // Right edge
        [600, 300], // Far right
        [620, 350], // Extended right
        [640, 450], // Extended top right
        [600, 600], // Top right
        [400, 620], // Top center
        [200, 615], // Top left center
        [100, 580], // Top left
        [80, 500],  // Left connection
        [100, 550]  // Close
      ]]),
      name: 'Top Building Areas'
    });

    // Bottom entrance areas
    const entranceAreasPolygon = new Feature({
      geometry: new Polygon([[
        [100, 50],  // Bottom left
        [500, 30],  // Bottom right
        [550, 80],  // Right entrance
        [500, 80],  // Gallery entrance right
        [480, 110], // Gallery bottom right
        [150, 120], // Gallery bottom left
        [120, 100], // Gallery entrance left
        [100, 100], // Left entrance
        [100, 50]   // Close
      ]]),
      name: 'Entrance Areas'
    });

    // Create vector layer for COMPLETE architectural features
    const zoneSource = new VectorSource({
      features: [
        buildingPerimeterPolygon,
        entranceAreasPolygon,
        leftWingPolygon,
        rightWingPolygon,
        scienceOfAgeingPolygon,
        yellowZonePolygon,
        pinkZonePolygon,
        topAreasPolygon
      ]
    });

    const zoneLayer = new VectorLayer({
      source: zoneSource,
      style: (feature) => {
        const name = feature.get('name');
        let fillColor, strokeColor, strokeWidth;

        switch (name) {
          case 'Building Perimeter':
            fillColor = 'rgba(220, 220, 220, 0.1)';
            strokeColor = '#2C3E50';
            strokeWidth = 4;
            break;
          case 'Left Wing Areas':
          case 'Right Wing Areas':
          case 'Top Building Areas':
          case 'Entrance Areas':
            fillColor = 'rgba(200, 200, 200, 0.15)';
            strokeColor = '#7F8C8D';
            strokeWidth = 2;
            break;
          case 'Science of Ageing Gallery':
            fillColor = 'rgba(142, 68, 173, 0.2)';
            strokeColor = '#8E44AD';
            strokeWidth = 3;
            break;
          case 'Yellow Zone':
            fillColor = 'rgba(255, 255, 153, 0.3)';
            strokeColor = '#F1C40F';
            strokeWidth = 3;
            break;
          case 'Pink Zone':
            fillColor = 'rgba(255, 182, 193, 0.3)';
            strokeColor = '#E91E63';
            strokeWidth = 3;
            break;
          default:
            fillColor = 'rgba(0, 0, 0, 0.1)';
            strokeColor = '#000';
            strokeWidth = 2;
        }

        return new Style({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: strokeColor, width: strokeWidth })
        });
      }
    });

    // Create exhibit markers using pixel coordinates
    const exhibitFeatures = dwtExhibits.map(exhibit => {
      const feature = new Feature({
        geometry: new Point(exhibit.coordinates),
        exhibit: exhibit
      });
      return feature;
    });

    const exhibitSource = new VectorSource({
      features: exhibitFeatures
    });

    const exhibitLayer = new VectorLayer({
      source: exhibitSource,
      style: (feature) => {
        const exhibit = feature.get('exhibit');
        const isActive = currentExhibit && exhibit.id === currentExhibit.id;
        const nextExhibit = getNextExhibit();
        const isNext = nextExhibit && exhibit.id === nextExhibit.id;

        const color = isActive ? '#4285F4' : isNext ? '#FF4757' : '#8E44AD';
        const radius = isActive ? 18 : isNext ? 15 : 12;

        return new Style({
          image: new Circle({
            radius: radius,
            fill: new Fill({ color: color }),
            stroke: new Stroke({ color: 'white', width: 3 })
          }),
          text: new Text({
            text: exhibit.number,
            font: 'bold 12px Arial',
            fill: new Fill({ color: 'white' }),
            textAlign: 'center',
            textBaseline: 'middle'
          })
        });
      }
    });

    // Initialize complete building floor plan map
    map.current = new Map({
      target: mapElement.current,
      layers: [zoneLayer, exhibitLayer],
      view: new View({
        center: [350, 350], // Center of complete building layout
        zoom: 1.0,
        maxZoom: 4,
        minZoom: 0.3,
        extent: [50, 0, 650, 650] // Full building bounds
      })
    });

    // Add click handler for exhibits
    map.current.on('click', (event) => {
      const feature = map.current.forEachFeatureAtPixel(event.pixel, (feature) => {
        if (feature.get('exhibit')) {
          return feature;
        }
      });

      if (feature) {
        const exhibit = feature.get('exhibit');
        handleExhibitClick(exhibit);
      }
    });

    // Add hover effect
    map.current.on('pointermove', (event) => {
      const hit = map.current.hasFeatureAtPixel(event.pixel);
      map.current.getTarget().style.cursor = hit ? 'pointer' : '';
    });

    return () => {
      if (map.current) {
        map.current.setTarget(undefined);
      }
    };
  }, []);

  // Update markers when current exhibit changes
  useEffect(() => {
    if (map.current) {
      const exhibitLayer = map.current.getLayers().getArray()[1]; // Get exhibit layer
      if (exhibitLayer) {
        exhibitLayer.getSource().changed(); // Trigger re-render
      }
    }
  }, [currentExhibit]);

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
              Complete Floor Plan • OpenLayers
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

      {/* OpenLayers Map */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '0 0 16px 16px'
      }}>
        <div
          ref={mapElement}
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
          🗺️ {dwtExhibits.length} Exhibits Total • Complete Floor Plan
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

export default DWTOpenLayersMap;