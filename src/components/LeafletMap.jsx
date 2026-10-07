import React from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const CIT_LOCATION = [14.8575988, 120.8124739];
const CIT_LABEL = 'Bulacan State University – College of Industrial Technology';

const LeafletMap = ({ destination = null, isTracking = false }) => {
  return (
    <div style={{
      overflow: 'hidden',
      border: '1px solid rgba(116, 213, 255, 0.18)',
      borderRadius: '16px',
      background: '#071522',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.2)'
    }}>
      <div style={{
        padding: '16px 18px',
        borderBottom: '1px solid rgba(116, 213, 255, 0.18)',
        background: 'rgba(8, 20, 35, 0.92)',
        color: '#eaf7ff'
      }}>
        <h3 style={{
          margin: 0,
          color: '#ffffff',
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
          lineHeight: 1.3
        }}>
          Bulacan State University – College of Industrial Technology
        </h3>
        <p style={{
          margin: '6px 0 0',
          color: '#8edcff',
          fontSize: '0.82rem'
        }}>
          Geographic landmark context
        </p>
        {destination && (
          <p style={{
            margin: '8px 0 0',
            color: '#dff6ff',
            fontSize: '0.82rem'
          }}>
            4th Floor · Destination: {destination.destination} · Live Tracking: {isTracking ? 'Active' : 'Unavailable'}
          </p>
        )}
      </div>

      <div style={{
        height: 'clamp(280px, 58vw, 500px)',
        width: '100%'
      }}>
        <MapContainer
          center={CIT_LOCATION}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          minZoom={15}
          maxZoom={20}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker position={CIT_LOCATION}>
            <Tooltip permanent direction="top" offset={[0, -22]}>
              {CIT_LABEL}
            </Tooltip>
            <Popup>{CIT_LABEL}</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default LeafletMap;
