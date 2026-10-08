import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOverlay, MapContainer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CIT_FLOOR_LABELS,
  CIT_FLOOR_PLAN_DIMENSIONS,
  CIT_ROUTE_NODES,
  CIT_ROUTE_STEPS,
} from '../navigation/citIndoorRoute.js';

function makeNumberIcon(number, active) {
  return L.divIcon({
    className: 'indoor-route-marker-wrapper',
    html: `<span class="indoor-route-marker${active ? ' is-active' : ''}">${number}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function makeArrowIcon(angle, active) {
  return L.divIcon({
    className: 'indoor-route-arrow-wrapper',
    html: `<span class="indoor-route-arrow${active ? ' is-active' : ''}" style="transform: rotate(${angle}deg)">➤</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function bearing([fromY, fromX], [toY, toX]) {
  return Math.atan2(toX - fromX, toY - fromY) * (180 / Math.PI);
}

function RecenterMap({ focusNode, floor }) {
  const map = useMap();

  useEffect(() => {
    if (focusNode?.floor !== floor || !focusNode.coordinates) return;
    map.flyTo(focusNode.coordinates, Math.max(map.getZoom(), -0.35), { duration: 0.35 });
  }, [focusNode, floor, map]);

  return null;
}

function MapClickPlacer({ activeNodeId, enabled, onPlace }) {
  useMapEvents({
    click(event) {
      if (enabled && activeNodeId) onPlace(activeNodeId, [event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

function DraggableWaypoint({ node, nodeIndex, position, active, editable, onMove }) {
  return (
    <Marker
      position={position}
      icon={makeNumberIcon(nodeIndex + 1, active)}
      draggable={editable}
      eventHandlers={{
        dragend(event) {
          const latLng = event.target.getLatLng();
          onMove(node.id, [latLng.lat, latLng.lng]);
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -14]}>{node.landmark}</Tooltip>
    </Marker>
  );
}

function getImageDimensions(url, fallback) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || fallback.defaultWidth, height: image.naturalHeight || fallback.defaultHeight });
    image.onerror = () => resolve({ width: fallback.defaultWidth, height: fallback.defaultHeight });
    image.src = url;
  });
}

function PublishedIndoorRouteMap({ floor, activeStep, onFloorChange, focusNode, publishedMap }) {
  const floorData = publishedMap?.floors?.[floor];
  const plan = floorData?.floorPlan;
  const dimensions = { ...CIT_FLOOR_PLAN_DIMENSIONS[floor], ...(plan || {}) };
  const mapWidth = dimensions.width || dimensions.defaultWidth;
  const mapHeight = dimensions.height || dimensions.defaultHeight;
  const bounds = [[0, 0], [mapHeight, mapWidth]];
  const landmarks = floorData?.landmarks || [];
  const activeRouteStep = CIT_ROUTE_STEPS[activeStep - 1];
  const activeIds = new Set([activeRouteStep?.from, activeRouteStep?.to]);
  const corridors = (floorData?.corridors || []).filter((corridor) => corridor.points?.length > 1);
  return <div className="indoor-route-map-shell">
    <div className="indoor-route-map-toolbar"><div><strong>{CIT_FLOOR_LABELS[floor]}</strong><span>{plan?.name || 'Published plan'}</span></div><div className="floor-switcher">{[1, 4].map((floorNumber) => <button key={floorNumber} className={floor === floorNumber ? 'is-selected' : ''} onClick={() => onFloorChange(floorNumber)} type="button">{CIT_FLOOR_LABELS[floorNumber]}</button>)}</div></div>
    <div className="indoor-route-map-canvas"><MapContainer center={[mapHeight / 2, mapWidth / 2]} zoom={-0.8} minZoom={-3} maxZoom={2} crs={L.CRS.Simple} bounds={bounds} maxBounds={bounds} style={{ height: '100%', width: '100%' }}>{plan?.dataUrl && <ImageOverlay url={plan.dataUrl} bounds={bounds} />}{corridors.map((corridor) => <Polyline key={corridor.id} positions={corridor.points} pathOptions={{ color: corridor.fromLandmarkId && activeIds.has(corridor.fromLandmarkId) && activeIds.has(corridor.toLandmarkId) ? '#0b74ff' : '#58a7ff', weight: corridor.fromLandmarkId && activeIds.has(corridor.fromLandmarkId) && activeIds.has(corridor.toLandmarkId) ? 9 : 5, opacity: .9, lineCap: 'round', lineJoin: 'round' }} />)}{landmarks.filter((landmark) => landmark.coordinates).map((landmark, index) => <Marker key={landmark.id} position={landmark.coordinates} icon={makeNumberIcon(index + 1, activeIds.has(landmark.id))}><Tooltip>{landmark.name}</Tooltip></Marker>)}</MapContainer>{!plan && <div className="indoor-route-empty-state">No published plan is available for {CIT_FLOOR_LABELS[floor]}.</div>}</div>
  </div>;
}

export default function IndoorRouteMap({ floor, activeStep, onFloorChange, focusNode, publishedMap }) {
  if (publishedMap) return <PublishedIndoorRouteMap floor={floor} activeStep={activeStep} onFloorChange={onFloorChange} focusNode={focusNode} publishedMap={publishedMap} />;
  const fallback = CIT_FLOOR_PLAN_DIMENSIONS[floor];
  const [floorPlans, setFloorPlans] = useState({});
  const [waypoints, setWaypoints] = useState({});
  const [editing, setEditing] = useState(false);
  const [placingNodeId, setPlacingNodeId] = useState('');
  const floorPlansRef = useRef(floorPlans);

  const plan = floorPlans[floor];
  const dimensions = { ...fallback, ...(plan || {}) };
  const mapWidth = dimensions.width || dimensions.defaultWidth;
  const mapHeight = dimensions.height || dimensions.defaultHeight;
  const bounds = [[0, 0], [mapHeight, mapWidth]];
  const floorNodes = CIT_ROUTE_NODES.filter((node) => node.floor === floor);
  const activeRouteStep = CIT_ROUTE_STEPS[activeStep - 1];
  const floorSegments = CIT_ROUTE_STEPS
    .filter((step) => step.floor === floor && !step.transition && waypoints[step.from] && waypoints[step.to])
    .map((step) => ({ ...step, positions: [waypoints[step.from], waypoints[step.to]] }));
  const activeSegment = floorSegments.find((segment) => segment.id === activeRouteStep?.id);
  const arrows = useMemo(() => floorSegments.map((segment) => ({
    ...segment,
    midpoint: [
      (segment.positions[0][0] + segment.positions[1][0]) / 2,
      (segment.positions[0][1] + segment.positions[1][1]) / 2,
    ],
    angle: bearing(segment.positions[0], segment.positions[1]),
  })), [floorSegments]);
  const unplacedFloorNode = floorNodes.find((node) => !waypoints[node.id]);

  useEffect(() => {
    setPlacingNodeId((current) => current && floorNodes.some((node) => node.id === current) ? current : unplacedFloorNode?.id || '');
  }, [floor, unplacedFloorNode?.id]);

  useEffect(() => {
    floorPlansRef.current = floorPlans;
  }, [floorPlans]);

  useEffect(() => () => {
    Object.values(floorPlansRef.current).forEach((currentPlan) => URL.revokeObjectURL(currentPlan.url));
  }, []);

  const placeWaypoint = (nodeId, coordinates) => {
    setWaypoints((current) => ({ ...current, [nodeId]: coordinates }));
    setPlacingNodeId('');
  };

  const importPlan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const imageDimensions = await getImageDimensions(url, fallback);
    setFloorPlans((current) => {
      if (current[floor]?.url) URL.revokeObjectURL(current[floor].url);
      return { ...current, [floor]: { url, ...imageDimensions, name: file.name } };
    });
    event.target.value = '';
  };

  return (
    <div className="indoor-route-map-shell">
      <div className="indoor-route-map-toolbar">
        <div>
          <strong>{CIT_FLOOR_LABELS[floor]}</strong>
          <span>{plan ? plan.name : 'No calibrated floor plan loaded'}</span>
        </div>
        <div className="floor-switcher" role="group" aria-label="Floor selection">
          {[1, 4].map((floorNumber) => (
            <button key={floorNumber} className={floor === floorNumber ? 'is-selected' : ''} onClick={() => onFloorChange(floorNumber)} type="button">
              {CIT_FLOOR_LABELS[floorNumber]}
            </button>
          ))}
        </div>
      </div>
      <div className="indoor-route-map-notice">
        {plan ? 'IMPORTED FLOOR PLAN - CALIBRATE WAYPOINTS BEFORE ROUTE USE' : 'NO CIT FLOOR PLAN AVAILABLE - IMPORT A REAL FLOOR PLAN TO CALIBRATE THIS FLOOR'}
      </div>
      <div className="indoor-route-map-tools">
        <label className="floor-plan-upload">
          Import {CIT_FLOOR_LABELS[floor]} image
          <input type="file" accept="image/*,.svg" onChange={importPlan} />
        </label>
        <button type="button" className={editing ? 'is-selected' : ''} onClick={() => setEditing((current) => !current)}>
          {editing ? 'Finish waypoint editing' : 'Edit waypoints'}
        </button>
        {editing && (
          <label>
            Place landmark
            <select value={placingNodeId} onChange={(event) => setPlacingNodeId(event.target.value)}>
              <option value="">Select a landmark</option>
              {floorNodes.map((node) => <option key={node.id} value={node.id}>{node.landmark}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="indoor-route-map-help">
        {editing ? 'Select a landmark, then click its position on the imported plan. Drag placed markers to refine them.' : 'Route lines appear only after both connected landmarks have calibrated positions.'}
      </div>
      <div className="indoor-route-map-canvas">
        <MapContainer
          center={[mapHeight / 2, mapWidth / 2]}
          zoom={-0.8}
          minZoom={-3}
          maxZoom={2}
          crs={L.CRS.Simple}
          bounds={bounds}
          maxBounds={bounds}
          maxBoundsViscosity={1}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          {plan && <ImageOverlay url={plan.url} bounds={bounds} opacity={1} />}
          {floorSegments.map((segment) => (
            <Polyline
              key={segment.id}
              positions={segment.positions}
              pathOptions={{
                color: segment.id === activeRouteStep?.id ? '#0b74ff' : '#58a7ff',
                weight: segment.id === activeRouteStep?.id ? 9 : 6,
                opacity: segment.id === activeRouteStep?.id ? 1 : 0.72,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          ))}
          {arrows.map((arrow) => (
            <Marker key={`${arrow.id}-arrow`} position={arrow.midpoint} icon={makeArrowIcon(arrow.angle, arrow.id === activeRouteStep?.id)} interactive={false} />
          ))}
          {floorNodes.map((node) => {
            const nodeIndex = CIT_ROUTE_NODES.findIndex((routeNode) => routeNode.id === node.id);
            return waypoints[node.id] ? (
              <DraggableWaypoint
                key={node.id}
                node={node}
                nodeIndex={nodeIndex}
                position={waypoints[node.id]}
                active={node.id === focusNode?.id}
                editable={editing}
                onMove={placeWaypoint}
              />
            ) : null;
          })}
          <MapClickPlacer activeNodeId={placingNodeId} enabled={editing && Boolean(plan)} onPlace={placeWaypoint} />
          <RecenterMap focusNode={focusNode ? { ...focusNode, coordinates: waypoints[focusNode.id] } : null} floor={floor} />
        </MapContainer>
        {!plan && <div className="indoor-route-empty-state">Import the actual CIT {CIT_FLOOR_LABELS[floor]} plan to view building geometry.</div>}
      </div>
      {activeSegment && <div className="indoor-route-calibration-status">Active route segment calibrated on this floor.</div>}
    </div>
  );
}
