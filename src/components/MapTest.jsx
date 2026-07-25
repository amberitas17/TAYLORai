import React, { useState } from 'react';
import DWTLeafletMap from './DWTLeafletMap';
import DWTCanvasMap from './DWTCanvasMap';
import DWTMapLibreMap from './DWTMapLibreMap';
import DWTMapboxMap from './DWTMapboxMap';
import DWTOpenLayersMap from './DWTOpenLayersMap';
import EAPOpenLayersMap from './EAPOpenLayersMap';
import DWTReferenceMap from './DWTReferenceMap';
import FullScienceCentreMap from './FullScienceCentreMap';
import LeafletMap from './LeafletMap';

const MapTest = () => {
  const [currentExhibit, setCurrentExhibit] = useState({
    id: 'DWT-10',
    name: 'Skin Ageing',
    zone: 'DWT'
  });
  const [mapType, setMapType] = useState('mapbox');

  const handleExhibitSelect = (exhibit) => {
    console.log('Selected exhibit:', exhibit);
    setCurrentExhibit(exhibit);
  };

  const getMapTypeName = () => {
    switch(mapType) {
      case 'full': return 'Full Science Centre Map';
      case 'reference': return 'Reference SVG Map';
      case 'maplibre': return 'MapLibre GL JS';
      case 'mapbox': return 'Mapbox GL JS';
      case 'openlayers-dwt': return 'OpenLayers DWT';
      case 'openlayers-eap': return 'OpenLayers EAP';
      case 'canvas': return 'HTML5 Canvas';
      case 'leaflet': return 'Leaflet DWT';
      case 'leaflet-osm-dwt': return 'OpenStreetMap + Leaflet (DWT)';
      case 'leaflet-osm-eap': return 'OpenStreetMap + Leaflet (EAP)';
      case 'leaflet-osm-both': return 'OpenStreetMap + Leaflet (Both)';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{
      padding: '20px',
      background: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '20px',
          color: '#333'
        }}>
          DWT Indoor Map Test - {getMapTypeName()}
        </h1>

        {/* Map Type Switcher */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setMapType('full')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'full' ? '#8E44AD' : '#ddd',
              color: mapType === 'full' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🏢 Full Building
          </button>
          <button
            onClick={() => setMapType('reference')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'reference' ? '#8E44AD' : '#ddd',
              color: mapType === 'reference' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            📋 DWT Only
          </button>
          <button
            onClick={() => setMapType('maplibre')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'maplibre' ? '#8E44AD' : '#ddd',
              color: mapType === 'maplibre' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🗺️ MapLibre
          </button>
          <button
            onClick={() => setMapType('mapbox')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'mapbox' ? '#8E44AD' : '#ddd',
              color: mapType === 'mapbox' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            📦 Mapbox
          </button>
          <button
            onClick={() => setMapType('openlayers-dwt')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'openlayers-dwt' ? '#8E44AD' : '#ddd',
              color: mapType === 'openlayers-dwt' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🌍 OL-DWT
          </button>
          <button
            onClick={() => setMapType('openlayers-eap')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'openlayers-eap' ? '#8E44AD' : '#ddd',
              color: mapType === 'openlayers-eap' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🌎 OL-EAP
          </button>
          <button
            onClick={() => setMapType('canvas')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'canvas' ? '#8E44AD' : '#ddd',
              color: mapType === 'canvas' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🎨 Canvas
          </button>
          <button
            onClick={() => setMapType('leaflet')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'leaflet' ? '#8E44AD' : '#ddd',
              color: mapType === 'leaflet' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🍃 Leaflet DWT
          </button>
          <button
            onClick={() => setMapType('leaflet-osm-dwt')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'leaflet-osm-dwt' ? '#27AE60' : '#ddd',
              color: mapType === 'leaflet-osm-dwt' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🗺️ OSM-DWT
          </button>
          <button
            onClick={() => setMapType('leaflet-osm-eap')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'leaflet-osm-eap' ? '#27AE60' : '#ddd',
              color: mapType === 'leaflet-osm-eap' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🌍 OSM-EAP
          </button>
          <button
            onClick={() => setMapType('leaflet-osm-both')}
            style={{
              padding: '10px 20px',
              margin: '0 5px',
              background: mapType === 'leaflet-osm-both' ? '#27AE60' : '#ddd',
              color: mapType === 'leaflet-osm-both' ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🌎 OSM-Both
          </button>
        </div>

        <div style={{
          marginBottom: '20px',
          padding: '15px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>Current Test Exhibit:</h3>
          <p><strong>ID:</strong> {currentExhibit.id}</p>
          <p><strong>Name:</strong> {currentExhibit.name}</p>
          <p><strong>Zone:</strong> {currentExhibit.zone}</p>
        </div>

        {/* Render selected map */}
        {mapType === 'full' ? (
          <FullScienceCentreMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        ) : mapType === 'reference' ? (
          <DWTReferenceMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        ) : mapType === 'maplibre' ? (
          <DWTMapLibreMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        ) : mapType === 'mapbox' ? (
          <DWTMapboxMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        ) : mapType === 'openlayers-dwt' ? (
          <DWTOpenLayersMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        ) : mapType === 'openlayers-eap' ? (
          <EAPOpenLayersMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        ) : mapType === 'canvas' ? (
          <DWTCanvasMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        ) : mapType === 'leaflet-osm-dwt' ? (
          <LeafletMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
            mapType="DWT"
            showTestControls={true}
          />
        ) : mapType === 'leaflet-osm-eap' ? (
          <LeafletMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
            mapType="EAP"
            showTestControls={true}
          />
        ) : mapType === 'leaflet-osm-both' ? (
          <LeafletMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
            mapType="both"
            showTestControls={true}
          />
        ) : (
          <DWTLeafletMap
            currentExhibit={currentExhibit}
            onExhibitSelect={handleExhibitSelect}
          />
        )}

        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>Expected Features:</h3>
          <ul>
            <li>🏢 Indoor floor plan layout for Science of Ageing gallery</li>
            <li>📍 Current exhibit (DWT-10) highlighted in blue</li>
            <li>🎯 Next exhibit (DWT-11) highlighted in red</li>
            <li>🛤️ Navigation path connecting current to next exhibit</li>
            <li>👆 Click any marker to select and navigate to it</li>
            <li>📊 All 22 DWT exhibits visible and properly positioned</li>
            <li>🗺️ MapLibre provides professional WebGL mapping</li>
            <li>📦 Mapbox provides premium mapping with exact positioning</li>
            <li>🌍 OpenLayers DWT provides beautiful tiles + full vector control</li>
            <li>🌎 OpenLayers EAP provides interactive Ecologies mapping</li>
            <li>🎨 Canvas provides direct drawing control</li>
            <li>🍃 Leaflet provides indoor geographic mapping</li>
            <li>🗺️ OSM-DWT shows real Singapore Science Centre with DWT exhibits</li>
            <li>🌍 OSM-EAP shows real building outline with EAP exhibits</li>
            <li>🌎 OSM-Both shows all exhibits on actual geographic location</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MapTest;