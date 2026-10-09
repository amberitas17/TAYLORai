import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AINavigation.css';
import LeafletMap from './LeafletMap';
import { CIT_FLOOR_LABELS, CIT_ROUTE_STEPS, getNode } from '../navigation/citIndoorRoute.js';
import { getCITWalkthroughEvidence } from '../navigation/citWalkthroughEvidence.js';

const TOUR_CENTERS = {
  ARICC: { fullName: 'Advanced Robotics and Intelligent Control Center', location: 'CIT - 4th Floor', route: '/machine-vision-exhibit-aricc' },
  RIO: { fullName: 'Research and Innovation Office', location: 'CIT - 4th Floor', route: '/machine-vision-rio' },
  FABLAB: { fullName: 'Center for Fabrication and Manufacture', location: 'CIT - 4th Floor', route: '/machine-vision-fablab' },
  CAESAR: { fullName: 'Center for Advanced Environmental Science and Agriculture Research', location: 'CIT - 4th Floor', route: '/machine-vision-caesar' },
  RECON: { fullName: 'Resiliency Energy Continuity Center', location: 'CIT - 4th Floor', route: '/machine-vision-recon' },
};
const LOCATION_OPTIONS = [
  { value: 'manual-cit-entrance', label: 'CIT Entrance', floor: 1, step: 1 },
  { value: 'manual-emh-department', label: 'EMH Department', floor: 1, step: 2 },
  { value: 'manual-elevator-1f', label: '1st Floor Elevator', floor: 1, step: 5 },
  { value: 'manual-4f-elevator', label: '4th Floor Elevator', floor: 4, step: 6 },
  { value: 'manual-olcpd', label: 'OLCPD', floor: 4, step: 7 },
  { value: 'manual-4f-hallway', label: '4th Floor Hallway', floor: 4, step: 9 },
];
const directionIcon = { left: '←', right: '→', straight: '↑', elevator: '↕', arrival: '●' };

function StepPhoto({ evidence, landmark }) {
  if (evidence.verified && evidence.photo) return <img className="navigation-photo" src={evidence.photo} alt={landmark} />;
  return <div className="navigation-photo navigation-photo--placeholder" role="img" aria-label={`Verified photograph pending for ${landmark}`}><span>PHOTO PENDING</span><small>Awaiting verified CIT walkthrough frame</small></div>;
}

export default function AINavigation({ onBack }) {
  const navigate = useNavigate();
  const [selectedDestination, setSelectedDestination] = useState('ARICC');
  const [manualLocation, setManualLocation] = useState('manual-cit-entrance');
  const [currentStep, setCurrentStep] = useState(1);
  const [mapOpen, setMapOpen] = useState(false);
  const touchStart = useRef(null);
  const location = LOCATION_OPTIONS.find((option) => option.value === manualLocation) || LOCATION_OPTIONS[0];
  const step = CIT_ROUTE_STEPS[currentStep - 1];
  const node = getNode(step?.from);
  const evidence = getCITWalkthroughEvidence(node.id);
  const direction = currentStep === CIT_ROUTE_STEPS.length ? 'arrival' : (step?.transition || node.id.startsWith('elevator-') ? 'elevator' : evidence.turn || 'straight');
  const destination = TOUR_CENTERS[selectedDestination];

  function goToStep(nextStep) {
    const bounded = Math.min(Math.max(nextStep, 1), CIT_ROUTE_STEPS.length);
    setCurrentStep(bounded);
  }

  function updateLocation(event) {
    const next = LOCATION_OPTIONS.find((option) => option.value === event.target.value) || LOCATION_OPTIONS[0];
    setManualLocation(next.value);
    setCurrentStep(next.step);
  }

  function onTouchStart(event) { const touch = event.touches?.[0] || event.changedTouches?.[0]; touchStart.current = touch ? touch.clientX : null; }
  function onTouchEnd(event) {
    if (touchStart.current === null) return;
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    const delta = touch.clientX - touchStart.current;
    if (Math.abs(delta) > 48) goToStep(currentStep + (delta < 0 ? 1 : -1));
    touchStart.current = null;
  }

  return <div className="ai-navigation-container navigation-mobile-shell">
    <main className="navigation-mobile-page">
      <header className="navigation-mobile-header"><button className="navigation-icon-button" onClick={onBack || (() => navigate(-1))} aria-label="Go back">‹</button><div><span className="navigation-kicker">TAYLOR AI</span><h1>Indoor directions</h1></div><button className="navigation-map-button" onClick={() => setMapOpen((open) => !open)}>{mapOpen ? 'Steps' : 'Map'}</button></header>
      <section className="navigation-route-picker"><label>Starting point<select value={manualLocation} onChange={updateLocation}>{LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Destination<select value={selectedDestination} onChange={(event) => { setSelectedDestination(event.target.value); setCurrentStep(1); }}><option>ARICC</option><option>RIO</option><option>FABLAB</option><option>CAESAR</option><option>RECON</option></select></label><div className="navigation-route-summary"><div><span>Starting from</span><strong>{location.label}</strong></div><div><span>Going to</span><strong>{selectedDestination}</strong></div></div></section>
      {mapOpen ? <section className="navigation-published-map" aria-label="Geographic CIT map"><LeafletMap destination={{ destination: selectedDestination }} isTracking /></section> : <section className="navigation-step-view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-live="polite"><div className="navigation-progress"><span>STEP {currentStep} OF {CIT_ROUTE_STEPS.length}</span><div>{CIT_ROUTE_STEPS.map((item, index) => <i className={index + 1 <= currentStep ? 'is-complete' : ''} key={item.id} />)}</div></div><StepPhoto evidence={evidence} landmark={node.landmark} /><div className="navigation-step-content"><div className={`navigation-direction navigation-direction--${direction}`}><strong>{directionIcon[direction]}</strong><span>{direction === 'arrival' ? 'Arrive' : direction === 'elevator' ? 'Floor change' : direction}</span></div><div className="navigation-step-meta"><span>{CIT_FLOOR_LABELS[step.floor]}</span><span>{evidence.verified ? `${evidence.sourceVideo} · ${evidence.timestamp}` : 'Evidence pending review'}</span></div><h2>{node.landmark}</h2><p>{step.instruction}</p><small className="navigation-confidence">{evidence.verified ? `Verified walkthrough evidence · ${evidence.confidence} confidence` : 'Neutral step retained until a walkthrough frame is verified.'}</small></div></section>}
      <nav className="navigation-step-controls"><button type="button" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>Previous</button><button type="button" className="navigation-next-button" onClick={() => goToStep(currentStep + 1)} disabled={currentStep === CIT_ROUTE_STEPS.length}>{currentStep === CIT_ROUTE_STEPS.length ? 'Arrived' : 'Next'}</button></nav>
      <footer className="navigation-footer"><span>Manual navigation · no GPS or camera</span><button type="button" onClick={() => navigate(destination.route, { state: { activeCenter: selectedDestination, tourMode: true } })}>Explore {selectedDestination}</button></footer>
    </main>
  </div>;
}
