import React, { useEffect, useMemo, useState } from 'react';
import { ImageOverlay, MapContainer, Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './AINavigation.css';
import './IndoorMapEditor.css';
import { CIT_FLOOR_LABELS, CIT_FLOOR_PLAN_DIMENSIONS } from '../navigation/citIndoorRoute.js';
import { loadAdminIndoorMap, publishAdminIndoorMap, saveAdminIndoorMap } from '../services/indoorMapService.js';

const DEFAULT_DESTINATIONS = ['ARICC', 'RIO', 'FABLAB', 'CAESAR', 'RECON', 'OVPREI', 'OLCPD'];
const emptyFloor = (floor) => ({ floor, floorPlan: null, landmarks: [], corridors: [] });
const markerIcon = (label) => L.divIcon({ className: 'indoor-route-marker-wrapper', html: `<span class="indoor-route-marker is-active">${label}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });

function EditorClick({ drawing, placingLandmark, onPoint, onLandmark }) {
  useMapEvents({ click(event) {
    const point = [event.latlng.lat, event.latlng.lng];
    if (drawing) onPoint(point);
    else if (placingLandmark) onLandmark(point);
  } });
  return null;
}

function makeDraft(map) {
  return {
    version: 1,
    building: 'CIT',
    status: 'draft',
    floors: { 1: map?.floors?.[1] || emptyFloor(1), 4: map?.floors?.[4] || emptyFloor(4) },
    floorConnections: map?.floorConnections || [],
    destinations: map?.destinations || DEFAULT_DESTINATIONS.map((name) => ({ id: name.toLowerCase(), name, landmarkId: '' })),
    validation: map?.validation || { valid: false, errors: [], warnings: [] },
    updatedAt: map?.updatedAt || null,
    publishedAt: map?.publishedAt || null,
  };
}

function imageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function IndoorMapEditor({ onBack }) {
  const [token, setToken] = useState('');
  const [map, setMap] = useState(null);
  const [floor, setFloor] = useState(1);
  const [message, setMessage] = useState('Enter the administrator token to load CIT map data.');
  const [drawing, setDrawing] = useState(false);
  const [corridorPoints, setCorridorPoints] = useState([]);
  const [corridorName, setCorridorName] = useState('');
  const [corridorFrom, setCorridorFrom] = useState('');
  const [corridorTo, setCorridorTo] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [placingLandmark, setPlacingLandmark] = useState(false);

  const currentFloor = map?.floors?.[floor] || emptyFloor(floor);
  const dimensions = currentFloor.floorPlan || CIT_FLOOR_PLAN_DIMENSIONS[floor];
  const bounds = [[0, 0], [dimensions.height || dimensions.defaultHeight, dimensions.width || dimensions.defaultWidth]];
  const floorLandmarks = currentFloor.landmarks || [];
  const floorPlanUrl = currentFloor.floorPlan?.dataUrl;

  useEffect(() => {
    const savedToken = sessionStorage.getItem('taylor-admin-token');
    if (savedToken) { setToken(savedToken); load(savedToken); }
  }, []);

  async function load(authToken = token) {
    try {
      const loaded = await loadAdminIndoorMap(authToken);
      sessionStorage.setItem('taylor-admin-token', authToken);
      setMap(makeDraft(loaded));
      setMessage('Draft map loaded. Changes remain unpublished until validation passes.');
    } catch (error) { setMessage(error.message); }
  }

  function updateFloor(updater) {
    setMap((current) => ({ ...current, floors: { ...current.floors, [floor]: updater(current.floors[floor] || emptyFloor(floor)) } }));
  }

  async function importFloorPlan(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await imageDataUrl(file);
    const image = new Image();
    image.onload = () => {
      updateFloor((current) => ({ ...current, floorPlan: { name: file.name, dataUrl, width: image.naturalWidth, height: image.naturalHeight } }));
      setMessage(`${CIT_FLOOR_LABELS[floor]} floor plan imported locally. Save draft to persist it.`);
    };
    image.src = dataUrl;
    event.target.value = '';
  }

  function placeLandmark(position) {
    if (!newLandmark.trim()) return;
    const id = `${newLandmark.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    updateFloor((current) => ({ ...current, landmarks: [...(current.landmarks || []), { id, name: newLandmark.trim(), floor, coordinates: position }] }));
    setNewLandmark('');
    setPlacingLandmark(false);
  }

  function moveLandmark(id, position) {
    updateFloor((current) => ({ ...current, landmarks: current.landmarks.map((landmark) => landmark.id === id ? { ...landmark, coordinates: position } : landmark) }));
  }

  function renameLandmark(landmark) {
    const name = window.prompt('Landmark name', landmark.name);
    if (!name?.trim()) return;
    updateFloor((current) => ({ ...current, landmarks: current.landmarks.map((item) => item.id === landmark.id ? { ...item, name: name.trim() } : item) }));
  }

  function deleteLandmark(id) {
    updateFloor((current) => ({ ...current, landmarks: current.landmarks.filter((landmark) => landmark.id !== id), corridors: current.corridors.filter((corridor) => corridor.fromLandmarkId !== id && corridor.toLandmarkId !== id) }));
    setMap((current) => ({ ...current, destinations: current.destinations.map((destination) => destination.landmarkId === id ? { ...destination, landmarkId: '' } : destination) }));
  }

  function finishCorridor() {
    if (corridorPoints.length < 2 || !corridorFrom || !corridorTo) { setMessage('A corridor needs two landmarks, a name, and at least two traced points.'); return; }
    updateFloor((current) => ({ ...current, corridors: [...(current.corridors || []), { id: `corridor-${Date.now()}`, name: corridorName || 'Hallway', fromLandmarkId: corridorFrom, toLandmarkId: corridorTo, points: corridorPoints, bidirectional: true }] }));
    setCorridorPoints([]); setCorridorName(''); setCorridorFrom(''); setCorridorTo(''); setDrawing(false);
  }

  function setDestinationLandmark(destinationId, landmarkId) {
    setMap((current) => ({ ...current, destinations: current.destinations.map((destination) => destination.id === destinationId ? { ...destination, landmarkId } : destination) }));
  }

  function setElevatorConnection(fromLandmarkId, toLandmarkId) {
    setMap((current) => ({ ...current, floorConnections: [{ id: 'cit-elevator-1f-4f', type: 'elevator', fromFloor: 1, toFloor: 4, fromLandmarkId, toLandmarkId, bidirectional: true }] }));
  }

  async function save() {
    try { setMap(await saveAdminIndoorMap(token, map)); setMessage('Draft saved persistently.'); } catch (error) { setMessage(error.message); }
  }

  async function publish() {
    try { const result = await publishAdminIndoorMap(token); setMap(result.map); setMessage('Published map saved. Visitors can now use it offline after sync.'); } catch (error) { setMessage(error.message); }
  }

  const elevatorLandmarks = useMemo(() => Object.values(map?.floors || {}).flatMap((item) => item.landmarks || []).filter((item) => /elevator/i.test(item.name)), [map]);

  if (!map) {
    return <div className="ai-navigation-container homepage-shell taylor-shell"><main className="navigation-page homepage-panel taylor-panel navigation-editor"><header className="navigation-header taylor-header"><button className="back-button" onClick={onBack}>Back</button><div className="header-content"><h1>CIT Indoor Map Editor</h1><p>Administrator access</p></div></header><section className="editor-card"><h2>Administrator sign-in</h2><p>{message}</p><label>Admin token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} /></label><button type="button" onClick={() => load()}>Load map editor</button></section></main></div>;
  }

  return (
    <div className="ai-navigation-container homepage-shell taylor-shell"><main className="navigation-page homepage-panel taylor-panel navigation-editor">
      <header className="navigation-header taylor-header"><button className="back-button" onClick={onBack}>Back</button><div className="header-content"><h1>CIT Indoor Map Editor</h1><p>Administrator-only draft workspace</p></div></header>
      <section className="editor-card"><div className="editor-toolbar"><div><strong>{map.status.toUpperCase()}</strong><p>{message}</p></div><div><button type="button" onClick={save}>Save draft</button><button type="button" onClick={publish}>Validate and publish</button></div></div><div className="editor-floor-tabs">{[1, 4].map((floorNumber) => <button type="button" key={floorNumber} className={floor === floorNumber ? 'is-selected' : ''} onClick={() => setFloor(floorNumber)}>{CIT_FLOOR_LABELS[floorNumber]}</button>)}</div></section>
      <section className="editor-card"><h2>Floor plan and corridor editor</h2><label>Import actual {CIT_FLOOR_LABELS[floor]} plan<input type="file" accept="image/*,.svg" onChange={importFloorPlan} /></label><div className="editor-map"><MapContainer center={[bounds[1][0] / 2, bounds[1][1] / 2]} zoom={-0.8} minZoom={-3} maxZoom={2} crs={L.CRS.Simple} bounds={bounds} maxBounds={bounds} style={{ height: '100%', width: '100%' }}>{floorPlanUrl && <ImageOverlay url={floorPlanUrl} bounds={bounds} />}{floorLandmarks.map((landmark) => <Marker key={landmark.id} position={landmark.coordinates} icon={markerIcon(landmark.name.slice(0, 2).toUpperCase())} draggable eventHandlers={{ dragend: (event) => { const point = event.target.getLatLng(); moveLandmark(landmark.id, [point.lat, point.lng]); } }}><Tooltip>{landmark.name}</Tooltip></Marker>)}{drawing && corridorPoints.length > 1 && <Polyline positions={corridorPoints} pathOptions={{ color: '#0b74ff', weight: 6 }} />}<EditorClick drawing={drawing} placingLandmark={placingLandmark && Boolean(floorPlanUrl)} onPoint={(point) => setCorridorPoints((current) => [...current, point])} onLandmark={placeLandmark} /></MapContainer>{!floorPlanUrl && <div className="indoor-route-empty-state">Import a real CIT floor plan before placing geometry.</div>}</div><div className="editor-tools"><input value={newLandmark} onChange={(event) => setNewLandmark(event.target.value)} placeholder="New landmark name" /><button type="button" onClick={() => { if (!newLandmark.trim() || !floorPlanUrl) return; setDrawing(false); setPlacingLandmark(true); setMessage('Click the imported map to place the new landmark.'); }}>Place landmark</button><button type="button" onClick={() => { setDrawing(true); setPlacingLandmark(false); setCorridorPoints([]); setMessage('Click multiple points along the actual hallway, then finish the corridor.'); }} disabled={!floorPlanUrl}>Draw corridor</button><input value={corridorName} onChange={(event) => setCorridorName(event.target.value)} placeholder="Corridor name" /><select value={corridorFrom} onChange={(event) => setCorridorFrom(event.target.value)}><option value="">From landmark</option>{floorLandmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}</select><select value={corridorTo} onChange={(event) => setCorridorTo(event.target.value)}><option value="">To landmark</option>{floorLandmarks.map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}</select><button type="button" onClick={finishCorridor} disabled={!drawing}>Finish corridor</button></div></section>
      <section className="editor-card"><h2>Landmarks</h2><div className="editor-landmark-list">{floorLandmarks.map((landmark) => <div className="editor-list-row" key={landmark.id}><span>{landmark.name}</span><button type="button" onClick={() => renameLandmark(landmark)}>Rename</button><button type="button" onClick={() => deleteLandmark(landmark.id)}>Delete</button></div>)}</div><h2>Corridors</h2><div className="editor-landmark-list">{(currentFloor.corridors || []).map((corridor) => <div className="editor-list-row" key={corridor.id}><span>{corridor.name}</span><small>{corridor.points.length} points</small></div>)}</div></section>
      <section className="editor-card"><h2>Destinations and floor connection</h2>{map.destinations.map((destination) => <label key={destination.id}>{destination.name}<select value={destination.landmarkId} onChange={(event) => setDestinationLandmark(destination.id, event.target.value)}><option value="">Uncalibrated</option>{Object.values(map.floors).flatMap((item) => item.landmarks || []).map((landmark) => <option key={landmark.id} value={landmark.id}>{landmark.name}</option>)}</select></label>)}<label>1st-floor elevator<select value={map.floorConnections[0]?.fromLandmarkId || ''} onChange={(event) => setElevatorConnection(event.target.value, map.floorConnections[0]?.toLandmarkId || '')}><option value="">Select elevator</option>{elevatorLandmarks.filter((item) => item.floor === 1).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>4th-floor elevator<select value={map.floorConnections[0]?.toLandmarkId || ''} onChange={(event) => setElevatorConnection(map.floorConnections[0]?.fromLandmarkId || '', event.target.value)}><option value="">Select elevator</option>{elevatorLandmarks.filter((item) => item.floor === 4).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{map.validation?.errors?.map((error) => <p className="editor-error" key={error}>{error}</p>)}</section>
    </main></div>
  );
}
