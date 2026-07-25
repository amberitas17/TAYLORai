import React, { useRef, useEffect, useState } from 'react';
import { Map, View, Feature } from 'ol';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Point, Polygon } from 'ol/geom';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import 'ol/ol.css';

const EAPOpenLayersMap = ({ currentExhibit = null, onExhibitSelect = null }) => {
  const mapElement = useRef();
  const map = useRef();
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // EAP exhibits positioned based on the complex floor plan PDF
  const eapExhibits = [
    // Main gallery exhibits spread throughout the complex building
    { id: 'EAP-01', name: 'Entrance Display', coordinates: [200, 100], number: '01' },
    { id: 'EAP-02', name: 'Timeline Wall', coordinates: [250, 120], number: '02' },
    { id: 'EAP-03', name: 'Ancient Ecosystems', coordinates: [300, 150], number: '03' },
    { id: 'EAP-04', name: 'Fossil Discovery', coordinates: [350, 180], number: '04' },
    { id: 'EAP-05', name: 'Climate Changes', coordinates: [400, 200], number: '05' },
    { id: 'EAP-06', name: 'Ice Age Diorama', coordinates: [450, 250], number: '06' },
    { id: 'EAP-07', name: 'Ocean Evolution', coordinates: [480, 300], number: '07' },
    { id: 'EAP-08', name: 'Land Formation', coordinates: [500, 350], number: '08' },
    { id: 'EAP-09', name: 'Volcanic Activity', coordinates: [480, 400], number: '09' },
    { id: 'EAP-10', name: 'Plate Tectonics', coordinates: [450, 450], number: '10' },

    { id: 'EAP-11', name: 'Mineral Gallery', coordinates: [400, 480], number: '11' },
    { id: 'EAP-12', name: 'Rock Cycle', coordinates: [350, 500], number: '12' },
    { id: 'EAP-13', name: 'Earthquake Zone', coordinates: [300, 520], number: '13' },
    { id: 'EAP-14', name: 'Weather Patterns', coordinates: [250, 500], number: '14' },
    { id: 'EAP-15', name: 'Atmosphere Display', coordinates: [200, 480], number: '15' },
    { id: 'EAP-16', name: 'Water Cycle', coordinates: [150, 450], number: '16' },
    { id: 'EAP-17', name: 'Erosion Demo', coordinates: [120, 400], number: '17' },
    { id: 'EAP-18', name: 'Sediment Layers', coordinates: [100, 350], number: '18' },
    { id: 'EAP-19', name: 'Fossil Formation', coordinates: [80, 300], number: '19' },
    { id: 'EAP-20', name: 'Prehistoric Life', coordinates: [100, 250], number: '20' },

    { id: 'EAP-21', name: 'Dinosaur Corner', coordinates: [120, 200], number: '21' },
    { id: 'EAP-22', name: 'Evolution Timeline', coordinates: [150, 150], number: '22' },
    { id: 'EAP-23', name: 'Species Diversity', coordinates: [180, 120], number: '23' },
    { id: 'EAP-24', name: 'Extinction Events', coordinates: [220, 140], number: '24' },
    { id: 'EAP-25', name: 'Natural Selection', coordinates: [260, 160], number: '25' },
    { id: 'EAP-26', name: 'Adaptation Examples', coordinates: [300, 180], number: '26' },
    { id: 'EAP-27', name: 'Biodiversity Hot Spots', coordinates: [340, 220], number: '27' },
    { id: 'EAP-28', name: 'Conservation Efforts', coordinates: [380, 260], number: '28' },
    { id: 'EAP-29', name: 'Human Impact', coordinates: [420, 300], number: '29' },
    { id: 'EAP-30', name: 'Future Earth', coordinates: [440, 340], number: '30' },

    // Interactive stations in central areas
    { id: 'EAP-31', name: 'VR Earth Journey', coordinates: [300, 300], number: '31' },
    { id: 'EAP-32', name: 'Touch Table - Minerals', coordinates: [280, 320], number: '32' },
    { id: 'EAP-33', name: 'Sound Station - Earth', coordinates: [320, 340], number: '33' },
    { id: 'EAP-34', name: 'Microscope Station', coordinates: [280, 360], number: '34' },
    { id: 'EAP-35', name: 'Digital Globe', coordinates: [320, 280], number: '35' },

    // Special exhibition areas
    { id: 'EAP-36', name: 'Temporary Exhibit 1', coordinates: [400, 380], number: '36' },
    { id: 'EAP-37', name: 'Temporary Exhibit 2', coordinates: [200, 400], number: '37' },
    { id: 'EAP-38', name: 'Research Corner', coordinates: [180, 380], number: '38' },
    { id: 'EAP-39', name: 'Lab Simulation', coordinates: [380, 420], number: '39' },
    { id: 'EAP-40', name: 'Discovery Workshop', coordinates: [160, 320], number: '40' }
  ];

  useEffect(() => {
    if (!mapElement.current) return;

    // EXACT EAP BUILDING FLOOR PLAN - Complex architectural shape from PDF

    // Main building outer perimeter - Very complex irregular shape
    const buildingPerimeterPolygon = new Feature({
      geometry: new Polygon([[
        // Complex multi-wing building shape from PDF
        [50, 80],   // Bottom left start
        [180, 60],  // Bottom edge first section
        [280, 70],  // Bottom edge middle
        [380, 85],  // Bottom edge right section
        [480, 100], // Bottom right approach
        [520, 140], // Right bottom corner
        [550, 200], // Right wall going up
        [570, 280], // Right middle section
        [580, 360], // Right upper section
        [575, 440], // Right approaching top
        [560, 500], // Right top section
        [530, 550], // Top right corner
        [480, 580], // Top right angled
        [420, 600], // Top edge right
        [350, 610], // Top center right
        [280, 605], // Top center
        [210, 600], // Top center left
        [150, 580], // Top left section
        [100, 550], // Top left corner
        [70, 500],  // Left top section
        [50, 440],  // Left approaching top
        [45, 360],  // Left upper section
        [50, 280],  // Left middle section
        [60, 200],  // Left wall
        [70, 140],  // Left bottom section
        [50, 80]    // Close to start
      ]]),
      name: 'Building Perimeter'
    });

    // Central circular gallery area
    const centralGalleryPolygon = new Feature({
      geometry: new Polygon([[
        [200, 200], // Center circle approximation
        [250, 210],
        [290, 240],
        [320, 280],
        [340, 320],
        [350, 360],
        [340, 400],
        [320, 440],
        [290, 470],
        [250, 490],
        [200, 500],
        [150, 490],
        [110, 470],
        [80, 440],
        [60, 400],
        [50, 360],
        [60, 320],
        [80, 280],
        [110, 240],
        [150, 210],
        [200, 200]  // Close
      ]]),
      name: 'Central Gallery'
    });

    // Left wing gallery
    const leftWingPolygon = new Feature({
      geometry: new Polygon([[
        [70, 140],  // Connect to main building
        [150, 120], // Wing right edge
        [180, 150], // Wing angled section
        [170, 200], // Wing upper right
        [140, 250], // Wing top right
        [100, 280], // Wing top edge
        [60, 260],  // Wing top left
        [45, 220],  // Wing left edge
        [50, 180],  // Wing left lower
        [70, 140]   // Close
      ]]),
      name: 'Left Wing Gallery'
    });

    // Right wing gallery
    const rightWingPolygon = new Feature({
      geometry: new Polygon([[
        [420, 140], // Connect to main building
        [480, 120], // Wing right edge
        [520, 150], // Wing bottom right
        [530, 200], // Wing right edge
        [520, 250], // Wing upper right
        [480, 280], // Wing top edge
        [440, 290], // Wing top left
        [410, 260], // Wing left edge
        [400, 220], // Wing left upper
        [420, 180], // Wing left lower
        [420, 140]  // Close
      ]]),
      name: 'Right Wing Gallery'
    });

    // Top exhibition hall
    const topHallPolygon = new Feature({
      geometry: new Polygon([[
        [150, 480], // Bottom left
        [350, 480], // Bottom right
        [380, 500], // Right angled
        [400, 540], // Right upper
        [380, 580], // Top right
        [350, 590], // Top edge right
        [250, 595], // Top center
        [150, 590], // Top edge left
        [120, 580], // Top left
        [100, 540], // Left upper
        [120, 500], // Left angled
        [150, 480]  // Close
      ]]),
      name: 'Top Exhibition Hall'
    });

    // Bottom entrance area
    const entranceAreaPolygon = new Feature({
      geometry: new Polygon([[
        [50, 50],   // Bottom left
        [480, 50],  // Bottom right
        [520, 80],  // Right entrance
        [480, 100], // Gallery entrance right
        [380, 85],  // Gallery bottom right
        [280, 70],  // Gallery bottom center
        [180, 60],  // Gallery bottom left
        [80, 80],   // Gallery entrance left
        [50, 80],   // Left entrance
        [50, 50]    // Close
      ]]),
      name: 'Entrance Areas'
    });

    // Research and laboratory areas
    const researchAreasPolygon = new Feature({
      geometry: new Polygon([[
        [380, 400], // Bottom left
        [480, 390], // Bottom right
        [520, 420], // Right edge
        [530, 460], // Right upper
        [510, 500], // Top right
        [470, 520], // Top edge
        [420, 525], // Top left
        [380, 500], // Left edge
        [370, 460], // Left upper
        [380, 420], // Left lower
        [380, 400]  // Close
      ]]),
      name: 'Research Areas'
    });

    // Interactive learning zones
    const interactiveZonesPolygon = new Feature({
      geometry: new Polygon([[
        [120, 350], // Bottom left
        [220, 340], // Bottom right
        [250, 370], // Right edge
        [260, 410], // Right upper
        [240, 450], // Top right
        [200, 470], // Top edge
        [160, 475], // Top left
        [120, 450], // Left edge
        [100, 410], // Left upper
        [110, 370], // Left lower
        [120, 350]  // Close
      ]]),
      name: 'Interactive Zones'
    });

    // Create vector layer for COMPLETE architectural features
    const zoneSource = new VectorSource({
      features: [
        buildingPerimeterPolygon,
        entranceAreaPolygon,
        leftWingPolygon,
        rightWingPolygon,
        centralGalleryPolygon,
        topHallPolygon,
        researchAreasPolygon,
        interactiveZonesPolygon
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
          case 'Central Gallery':
            fillColor = 'rgba(52, 152, 219, 0.2)';
            strokeColor = '#3498DB';
            strokeWidth = 3;
            break;
          case 'Left Wing Gallery':
          case 'Right Wing Gallery':
            fillColor = 'rgba(46, 204, 113, 0.2)';
            strokeColor = '#2ECC71';
            strokeWidth = 3;
            break;
          case 'Top Exhibition Hall':
            fillColor = 'rgba(155, 89, 182, 0.2)';
            strokeColor = '#9B59B6';
            strokeWidth = 3;
            break;
          case 'Research Areas':
            fillColor = 'rgba(241, 196, 15, 0.2)';
            strokeColor = '#F1C40F';
            strokeWidth = 3;
            break;
          case 'Interactive Zones':
            fillColor = 'rgba(231, 76, 60, 0.2)';
            strokeColor = '#E74C3C';
            strokeWidth = 3;
            break;
          case 'Entrance Areas':
            fillColor = 'rgba(200, 200, 200, 0.15)';
            strokeColor = '#7F8C8D';
            strokeWidth = 2;
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
    const exhibitFeatures = eapExhibits.map(exhibit => {
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

        const color = isActive ? '#E74C3C' : isNext ? '#F39C12' : '#3498DB';
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
        center: [300, 350], // Center of complete building layout
        zoom: 0.9,
        maxZoom: 4,
        minZoom: 0.3,
        extent: [30, 30, 600, 650] // Full building bounds
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
    const currentIndex = eapExhibits.findIndex(exhibit => exhibit.id === currentExhibit.id);
    if (currentIndex === -1) return null;
    const nextIndex = currentIndex + 1 < eapExhibits.length ? currentIndex + 1 : 0;
    return eapExhibits[nextIndex];
  };

  const handleExhibitClick = (exhibit) => {
    setSelectedExhibit(exhibit);
    if (onExhibitSelect) {
      onExhibitSelect({
        id: exhibit.id,
        name: exhibit.name,
        zone: 'EAP',
        coordinates: exhibit.coordinates
      });
    }
  };

  return (
    <div style={{
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      background: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
      padding: '4px'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
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
              Earth Alive (EAP)
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
              background: '#E74C3C'
            }}></div>
            Current
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#F39C12'
            }}></div>
            Next
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#3498DB'
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
          🗺️ {eapExhibits.length} Exhibits Total • Complete Floor Plan
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
            <h4 style={{ margin: '0 0 5px 0', color: '#3498DB' }}>
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

export default EAPOpenLayersMap;