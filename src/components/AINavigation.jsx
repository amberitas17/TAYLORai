import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AINavigation.css';
import LeafletMap from './LeafletMap';
import { CIT_FLOOR_LABELS, getDestinationRoute, getNode } from '../navigation/citIndoorRoute.js';
import { getCITWalkthroughEvidence } from '../navigation/citWalkthroughEvidence.js';
import IndoorNavigationState from '../services/indoorNavigationState.js';
import { handleSpeechInteraction, textToSpeech } from '../services/speechAPI.js';

const Hologram = lazy(() => import('../hologram.jsx'));

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
const eventPose = { START: 'navigation-start', TURN_LEFT: 'navigation-left', TURN_RIGHT: 'navigation-right', WALK_FORWARD: 'navigation-forward', LANDMARK_CONFIRMED: 'navigation-start', ARRIVED: 'navigation-arrived', UNCERTAIN: 'neutral', IDLE: 'neutral' };

class NavigationAvatarBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    return this.state.failed ? <div className="navigation-avatar-fallback" role="status">Voice directions remain available. Avatar display unavailable.</div> : this.props.children;
  }
}

function NavigationAvatar({ event, instruction, muted, onMute, expanded, onToggle }) {
  const [speaking, setSpeaking] = useState(false);
  const previousEvent = useRef('');

  useEffect(() => {
    if (muted || !instruction || previousEvent.current === `${event}:${instruction}`) return undefined;
    previousEvent.current = `${event}:${instruction}`;
    let active = true;
    setSpeaking(true);
    handleSpeechInteraction();
    textToSpeech(instruction, false, 'taylor', 'en').finally(() => {
      if (active) setSpeaking(false);
    });
    return () => { active = false; };
  }, [event, instruction, muted]);

  return <aside className={`navigation-avatar-panel ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="TAYLOR navigation guide">
    <div className="navigation-avatar-toolbar">
      <strong>TAYLOR guide</strong>
      <div>
        <button type="button" onClick={onMute} aria-label={muted ? 'Unmute TAYLOR' : 'Mute TAYLOR'}>{muted ? 'Unmute' : 'Mute'}</button>
        <button type="button" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Collapse' : 'Expand'}</button>
      </div>
    </div>
    {expanded && <>
      <div className="navigation-avatar-stage">
        <NavigationAvatarBoundary>
          <Suspense fallback={<div className="navigation-avatar-loading">Preparing avatar…</div>}>
            <Hologram emotion={event === 'ARRIVED' ? 'happy' : 'neutral'} isAnimating={speaking || event !== 'IDLE'} spokenText={instruction || ''} disableAnimations={false} poseMode={eventPose[event] || 'neutral'} assetPreset="idle" />
          </Suspense>
        </NavigationAvatarBoundary>
      </div>
      <p className="navigation-avatar-status" aria-live="polite">{instruction || 'Waiting for a confirmed navigation landmark.'}</p>
    </>}
  </aside>;
}

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
  const [avatarExpanded, setAvatarExpanded] = useState(true);
  const [avatarMuted, setAvatarMuted] = useState(false);
  const navigationStateRef = useRef(null);
  const [navigationEvent, setNavigationEvent] = useState('IDLE');
  const touchStart = useRef(null);
  const location = LOCATION_OPTIONS.find((option) => option.value === manualLocation) || LOCATION_OPTIONS[0];
  const route = getDestinationRoute(selectedDestination);
  const step = route.steps[currentStep - 1];
  const node = getNode(step?.from);
  const evidence = getCITWalkthroughEvidence(node.id);
  const direction = route.complete && currentStep === route.steps.length ? 'arrival' : (step?.transition || node.id.startsWith('elevator-') ? 'elevator' : evidence.turn || 'straight');
  const destination = TOUR_CENTERS[selectedDestination];

  useEffect(() => {
    navigationStateRef.current = new IndoorNavigationState({ destination: selectedDestination, startFloor: location.floor, targetFloor: 4 });
    setCurrentStep(1);
    setNavigationEvent('START');
  }, [selectedDestination, location.floor]);

  const getNavigationEvent = (nextDirection, nextStep) => {
    if (route.complete && nextStep === route.steps.length) return 'ARRIVED';
    if (nextDirection === 'left') return 'TURN_LEFT';
    if (nextDirection === 'right') return 'TURN_RIGHT';
    if (nextDirection === 'elevator') return 'WALK_FORWARD';
    return 'WALK_FORWARD';
  };

  function goToStep(nextStep) {
    const bounded = Math.min(Math.max(nextStep, 1), route.steps.length);
    setCurrentStep(bounded);
    const nextRouteStep = route.steps[bounded - 1];
    const nextNode = getNode(nextRouteStep?.from);
    const nextEvidence = getCITWalkthroughEvidence(nextNode.id);
    const nextDirection = route.complete && bounded === route.steps.length ? 'arrival' : (nextRouteStep?.transition || nextNode.id.startsWith('elevator-') ? 'elevator' : nextEvidence.turn || 'straight');
    setNavigationEvent(route.complete && bounded === route.steps.length ? 'ARRIVED' : getNavigationEvent(nextDirection, bounded));
  }

  function updateLocation(event) {
    const next = LOCATION_OPTIONS.find((option) => option.value === event.target.value) || LOCATION_OPTIONS[0];
    setManualLocation(next.value);
    setCurrentStep(next.step);
    navigationStateRef.current?.recoverNavigation();
    setNavigationEvent('UNCERTAIN');
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

  const confirmCurrentLandmark = () => {
    const confirmation = navigationStateRef.current?.confirmLandmark(node.id === 'elevator-1f' ? 'elevator' : node.id === 'aricc' ? selectedDestination : node.id);
    setNavigationEvent(confirmation?.state?.current_landmark === selectedDestination ? 'ARRIVED' : 'LANDMARK_CONFIRMED');
  };

  return <div className="ai-navigation-container navigation-mobile-shell">
    <main className="navigation-mobile-page">
      <header className="navigation-mobile-header"><button className="navigation-icon-button" onClick={onBack || (() => navigate(-1))} aria-label="Go back">‹</button><div><span className="navigation-kicker">TAYLOR AI</span><h1>Indoor directions</h1></div><button className="navigation-map-button" onClick={() => setMapOpen((open) => !open)}>{mapOpen ? 'Steps' : 'Map'}</button></header>
      <section className="navigation-route-picker"><label>Starting point<select value={manualLocation} onChange={updateLocation}>{LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Destination<select value={selectedDestination} onChange={(event) => { setSelectedDestination(event.target.value); setCurrentStep(1); }}><option>ARICC</option><option>RIO</option><option>FABLAB</option><option>CAESAR</option><option>RECON</option></select></label><div className="navigation-route-summary"><div><span>Starting from</span><strong>{location.label}</strong></div><div><span>Going to</span><strong>{selectedDestination}</strong></div></div></section>
      <NavigationAvatar event={navigationEvent} instruction={step?.instruction} muted={avatarMuted} onMute={() => setAvatarMuted((muted) => !muted)} expanded={avatarExpanded} onToggle={() => setAvatarExpanded((expanded) => !expanded)} />
      {mapOpen ? <section className="navigation-published-map" aria-label="Geographic CIT map"><LeafletMap destination={{ destination: selectedDestination }} isTracking /></section> : <section className="navigation-step-view" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-live="polite"><div className="navigation-progress"><span>STEP {currentStep} OF {route.steps.length}</span><div>{route.steps.map((item, index) => <i className={index + 1 <= currentStep ? 'is-complete' : ''} key={item.id} />)}</div></div><StepPhoto evidence={evidence} landmark={node.landmark} /><div className="navigation-step-content"><div className={`navigation-direction navigation-direction--${direction}`}><strong>{directionIcon[direction]}</strong><span>{direction === 'arrival' ? 'Arrive' : direction === 'elevator' ? 'Floor change' : direction}</span></div><div className="navigation-step-meta"><span>{CIT_FLOOR_LABELS[step.floor]}</span><span>{evidence.verified ? `${evidence.sourceVideo} · ${evidence.timestamp}` : 'Evidence pending review'}</span></div><h2>{node.landmark}</h2><p>{step.instruction}</p><small className="navigation-confidence">{evidence.verified ? `Verified walkthrough evidence · ${evidence.confidence} confidence` : 'Neutral step retained until a walkthrough frame is verified.'}</small>{!route.complete && <small className="navigation-route-incomplete">Route to {route.destination} is incomplete after this verified step. Arrival is not reported.</small>}</div></section>}
      <nav className="navigation-step-controls"><button type="button" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>Previous</button><button type="button" onClick={confirmCurrentLandmark}>Confirm landmark</button><button type="button" className="navigation-next-button" onClick={() => goToStep(currentStep + 1)} disabled={currentStep === route.steps.length}>{route.complete && currentStep === route.steps.length ? 'Arrived' : 'Next'}</button></nav>
      <footer className="navigation-footer"><span>Manual navigation · no GPS or camera</span><button type="button" onClick={() => navigate(destination.route, { state: { activeCenter: selectedDestination, tourMode: true } })}>Explore {selectedDestination}</button></footer>
    </main>
  </div>;
}
