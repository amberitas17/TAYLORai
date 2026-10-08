import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AINavigation.css';
import FloorPlanMap from './FloorPlanMap';
import LeafletMap from './LeafletMap';
import { textToSpeech } from '../services/speechAPI.js';
import IndoorNavigationRuntime from '../services/indoorNavigationRuntime.js';
import IndoorNavigationState from '../services/indoorNavigationState.js';
import recognizeNavigationLandmark from '../services/navigationLandmarkRecognition.js';

const AINavigation = ({
  onBack,
  detectedExhibit,
  onExhibitSelect,
  landmarkClassifier,
}) => {
  const navigate = useNavigate();
  const TOUR_CENTERS = {
    ARICC: { fullName: 'Advanced Robotics and Intelligent Control Center', location: 'CIT • 4th Floor', route: '/machine-vision-exhibit-aricc' },
    RIO: { fullName: 'Research and Innovation Office', location: 'CIT • 4th Floor', route: '/machine-vision-rio' },
    FABLAB: { fullName: 'Center for Fabrication and Manufacture', location: 'CIT • 4th Floor', route: '/machine-vision-fablab' },
    CAESAR: { fullName: 'Center for Advanced Environmental Science and Agriculture Research', location: 'CIT • 4th Floor', route: '/machine-vision-caesar' },
    RECON: { fullName: 'Resiliency Energy Continuity Center', location: 'CIT • 4th Floor', route: '/machine-vision-recon' },
  };
  const formatLandmark = (landmark) => String(landmark || 'Unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

  const [currentExhibit, setCurrentExhibit] = useState(2);
  const [totalExhibits] = useState(23);
  const [currentLocation, setCurrentLocation] = useState({ x: 50, y: 60 });
  const [selectedExhibit, setSelectedExhibit] = useState(null);
  const [pathData, setPathData] = useState({
    distance: '76m',
    steps: 147,
    direction: 'West',
    tracked: 5
  });

  // Live tracking state
  const [stepCount, setStepCount] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentDirection, setCurrentDirection] = useState('North');
  const [isTracking, setIsTracking] = useState(false);
  const stepDetectionRef = useRef(null);
  const lastAccelerationRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const navigationRuntimeRef = useRef(null);
  const [navigationState, setNavigationState] = useState(null);
  const [confirmedLandmark, setConfirmedLandmark] = useState(null);
  const [navigationInstruction, setNavigationInstruction] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState('aricc');
  const [startFloor] = useState(1);
  const [targetFloor] = useState(4);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const recognitionTimerRef = useRef(null);
  const recognitionInFlightRef = useRef(false);

  useEffect(() => {
    const runtime = new IndoorNavigationRuntime({
      navigationState: new IndoorNavigationState({
        startFloor,
        targetFloor,
          destination: 'aricc',
      }),
    });
    navigationRuntimeRef.current = runtime;
    setNavigationState(runtime.navigationState.getState());
    setNavigationInstruction(null);

    return () => {
      if (navigationRuntimeRef.current === runtime) {
        navigationRuntimeRef.current = null;
      }
    };
  }, [startFloor, targetFloor]);

  useEffect(() => {
    const runtime = navigationRuntimeRef.current;
    if (!runtime) return;
    setNavigationState({
      ...runtime.navigationState.setDestination(selectedDestination),
    });
  }, [selectedDestination]);

  useEffect(() => {
    let cancelled = false;

    const stopCamera = () => {
      if (recognitionTimerRef.current) {
        clearInterval(recognitionTimerRef.current);
        recognitionTimerRef.current = null;
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const processFrame = async () => {
      if (cancelled || recognitionInFlightRef.current || !videoRef.current?.srcObject) return;
      recognitionInFlightRef.current = true;
      try {
        const prediction = await recognizeNavigationLandmark(videoRef.current, landmarkClassifier);
        if (cancelled) return;
        const result = navigationRuntimeRef.current?.processPrediction(prediction);
        if (!result) return;
        setNavigationState(result.navigation.state);
        if (result.confirmation.confirmed && result.confirmation.landmark !== 'unknown') {
          setConfirmedLandmark(result.confirmation.landmark);
        }
        if (result.navigation.instruction) {
          setNavigationInstruction(result.navigation.instruction);
          await textToSpeech(result.navigation.instruction, false, 'taylor', 'en');
        }
      } catch (error) {
        console.warn('[taylor] navigation landmark recognition failed', error);
      } finally {
        recognitionInFlightRef.current = false;
      }
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        await processFrame();
        recognitionTimerRef.current = setInterval(processFrame, 1000);
      } catch (error) {
        console.warn('[taylor] navigation camera unavailable', error);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [landmarkClassifier]);

  // Exhibit locations on the map (as percentages)
  const exhibits = [
    { id: 1, name: 'Giant Labyrinth', x: 15, y: 40, visited: true, key: 'laser_maze' },
    { id: 2, name: 'Laser Maze Challenge', x: 45, y: 50, visited: true, current: true, key: 'laser_maze' },
    { id: 3, name: 'Robot Station', x: 75, y: 30, visited: false, key: 'future_makers' },
    { id: 4, name: 'Space Explorer', x: 25, y: 75, visited: false, key: 'e3' },
    { id: 5, name: 'DNA Lab', x: 85, y: 60, visited: false, key: 'everyday_science' },
    { id: 6, name: 'Energy Zone', x: 60, y: 80, visited: false, key: 'energy' }
  ];

  // Live tracking with device sensors
  useEffect(() => {
    let cancelled = false;
    let accelerometerSubscription = null;
    let orientationSubscription = null;

    const startLiveTracking = async () => {
      try {
        // Request device motion permission
        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
          const permission = await DeviceMotionEvent.requestPermission();
          if (permission !== 'granted') {
            console.log('Device motion permission denied');
            return;
          }
        }

        // Set up step detection using devicemotion
        const handleDeviceMotion = (event) => {
          if (!event.accelerationIncludingGravity) return;

          const { x, y, z } = event.accelerationIncludingGravity;
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          // Simple step detection algorithm
          const now = Date.now();
          const stepThreshold = 12; // Adjusted for web

          if (magnitude > stepThreshold &&
              magnitude > lastAccelerationRef.current &&
              now - lastStepTimeRef.current > 500) { // Minimum 500ms between steps
            setStepCount(prev => prev + 1);
            setTotalDistance(prev => prev + 0.75); // Average step length ~0.75m
            lastStepTimeRef.current = now;
          }
          lastAccelerationRef.current = magnitude;
        };

        // Set up direction detection using deviceorientation
        const handleDeviceOrientation = (event) => {
          if (event.alpha !== null) {
            let heading = event.alpha;
            if (heading < 0) heading += 360;

            // Convert heading to cardinal direction
            let direction = 'North';
            if (heading >= 315 || heading < 45) direction = 'North';
            else if (heading >= 45 && heading < 135) direction = 'East';
            else if (heading >= 135 && heading < 225) direction = 'South';
            else if (heading >= 225 && heading < 315) direction = 'West';

            setCurrentDirection(direction);
          }
        };

        // Add event listeners
        window.addEventListener('devicemotion', handleDeviceMotion);
        window.addEventListener('deviceorientation', handleDeviceOrientation);

        setIsTracking(true);
        console.log('Live tracking started');

        // Cleanup function
        return () => {
          window.removeEventListener('devicemotion', handleDeviceMotion);
          window.removeEventListener('deviceorientation', handleDeviceOrientation);
          setIsTracking(false);
        };

      } catch (error) {
        console.log('Live tracking not available:', error);
        // Fallback to simulated tracking for desktop
        return startSimulatedTracking();
      }
    };

    const startSimulatedTracking = () => {
      // Simulated movement for desktop testing
      const interval = setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance of "step" per second
          setStepCount(prev => prev + 1);
          setTotalDistance(prev => prev + 0.75);
        }

        // Rotate direction occasionally
        if (Math.random() > 0.9) {
          const directions = ['North', 'East', 'South', 'West'];
          setCurrentDirection(directions[Math.floor(Math.random() * directions.length)]);
        }
      }, 1000);

      setIsTracking(true);
      return () => clearInterval(interval);
    };

    let trackingCleanup;
    startLiveTracking().then((cleanup) => {
      if (typeof cleanup !== 'function') return;
      if (cancelled) {
        cleanup();
      } else {
        trackingCleanup = cleanup;
      }
    });

    return () => {
      cancelled = true;
      if (typeof trackingCleanup === 'function') {
        trackingCleanup();
      }
    };
  }, []);

  // Update current exhibit when detection changes
  useEffect(() => {
    if (detectedExhibit && detectedExhibit.name) {
      const exhibit = exhibits.find(e =>
        e.name.toLowerCase().includes(detectedExhibit.name.toLowerCase())
      );
      if (exhibit) {
        setCurrentExhibit(exhibit.id);
        setCurrentLocation({ x: exhibit.x, y: exhibit.y });
      }
    }
  }, [detectedExhibit]);

  const handleExhibitClick = (exhibit) => {
    setSelectedExhibit(exhibit);
    if (onExhibitSelect) {
      onExhibitSelect(exhibit);
    }
  };

  const renderPath = () => {
    if (!selectedExhibit) return null;

    const current = exhibits.find(e => e.current);
    if (!current) return null;

    // Simple path rendering - in real implementation would use proper pathfinding
    const pathPoints = [
      `${current.x}% ${current.y}%`,
      `${(current.x + selectedExhibit.x) / 2}% ${(current.y + selectedExhibit.y) / 2}%`,
      `${selectedExhibit.x}% ${selectedExhibit.y}%`
    ];

    return (
      <polyline
        points={pathPoints.join(', ')}
        stroke="#2196F3"
        strokeWidth="3"
        fill="none"
        strokeDasharray="5,5"
        className="navigation-path"
      />
    );
  };

  const arrivalCenter = TOUR_CENTERS[String(selectedDestination).toUpperCase()];
  const hasArrived = Boolean(
    navigationState?.current_landmark &&
    navigationState.current_landmark === String(selectedDestination).toUpperCase() &&
    arrivalCenter
  );

  const exploreCenter = () => {
    if (!arrivalCenter) return;
    navigate(arrivalCenter.route, {
      state: {
        activeCenter: String(selectedDestination).toUpperCase(),
        recognitionZone: String(selectedDestination).toLowerCase(),
        tourMode: true,
      },
    });
  };

  const askTaylorAboutCenter = () => {
    navigate('/taylor', { state: { activeEntity: String(selectedDestination).toUpperCase() } });
  };

  return (
    <div className="ai-navigation-container homepage-shell taylor-shell">
      <main className="navigation-page homepage-panel taylor-panel">
      <header className="navigation-header taylor-header">
        <button className="back-button" onClick={onBack || (() => navigate(-1))}>
          ← Back
        </button>
        <div className="header-content">
          <h1>BULSU Research Innovation Unit</h1>
          <p>Interactive Exhibit Guide</p>
        </div>
      </header>

      {navigationState && (
        <section className="indoor-navigation-status" data-testid="indoor-navigation-status">
          <div className="indoor-navigation-status__destination">
            <strong>LIVE TRACKING ACTIVE</strong>
            <span>Indoor position via confirmed camera recognition</span>
          </div>
          <label>
            Destination
            <select value={selectedDestination} onChange={(event) => setSelectedDestination(event.target.value)}>
              <option value="aricc">ARICC</option>
              <option value="fablab">FABLAB</option>
              <option value="caesar">CAESAR</option>
              <option value="rio">RIO</option>
              <option value="recon">RECON</option>
            </select>
          </label>
          <div className="indoor-navigation-status__field">
            <span>Current Location</span>
            <strong>{confirmedLandmark ? confirmedLandmark.toUpperCase() : 'Searching for landmark...'}</strong>
          </div>
          <div className="indoor-navigation-status__field">
            <span>Building</span>
            <strong>College of Industrial Technology (CIT)</strong>
          </div>
          <div className="indoor-navigation-status__field">
            <span>{confirmedLandmark ? 'Current Floor' : 'Target Floor'}</span>
            <strong>{confirmedLandmark ? '4th Floor' : `${navigationState.target_floor}th Floor`}</strong>
          </div>
          <div className="indoor-navigation-status__field">
            <span>Destination</span>
            <strong>{String(navigationState.destination || selectedDestination).toUpperCase()}</strong>
          </div>
          {confirmedLandmark && (
            <div className="indoor-navigation-status__recognition">Landmark Confirmed</div>
          )}
          {navigationState.floor_transition_active && (
            <div>Next: {navigationState.target_floor}th Floor - {formatLandmark(navigationState.next_expected_landmark)}</div>
          )}
          {confirmedLandmark && !navigationState.floor_transition_active && navigationState.next_expected_landmark && (
            <div>Next: {formatLandmark(navigationState.next_expected_landmark)}</div>
          )}
          {!confirmedLandmark && !navigationState.floor_transition_active && (
            <div>Next Landmark: Awaiting route data</div>
          )}
          {confirmedLandmark && !navigationState.floor_transition_active && !navigationState.next_expected_landmark && (
            <div>Next Landmark: Awaiting route data</div>
          )}
          {navigationInstruction && (
            <div className="indoor-navigation-status__instruction">{navigationInstruction}</div>
          )}
        </section>
      )}

      {hasArrived && (
        <section className="navigation-arrival" aria-live="polite" data-testid="arrival-experience">
          <div className="navigation-arrival__status">✓ You've Arrived</div>
          <h2>{String(selectedDestination).toUpperCase()}</h2>
          <p>{arrivalCenter.fullName}</p>
          <p>{arrivalCenter.location}</p>
          <div className="navigation-arrival__actions">
            <button onClick={exploreCenter}>Explore {String(selectedDestination).toUpperCase()} Exhibits</button>
            <button onClick={askTaylorAboutCenter}>Ask TAYLOR About {String(selectedDestination).toUpperCase()}</button>
            <button onClick={onBack || (() => navigate(-1))}>End Navigation</button>
          </div>
        </section>
      )}

      <div className="detect-button-container">
        <button className="detect-exhibit-btn">
          👁 Detect Exhibit Display
        </button>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Navigation camera"
        className="navigation-camera"
      />

      <div className="map-section">
        <h2>BULSU CIT</h2>
        <p className="geographic-context-label">College of Industrial Technology</p>
        <p className="geographic-hierarchy">Bulacan State University &gt; College of Industrial Technology &gt; 4th Floor</p>

        {/* Live tracking status */}
        <div className="tracking-status">
          <span className={`tracking-indicator ${isTracking ? 'active' : ''}`}>
            📍 {isTracking ? 'Live Tracking Active' : 'Tracking Unavailable'}
          </span>
        </div>

        {/* Geographic landmark context remains separate from indoor navigation. */}
        <div className="map-image-container">
          <LeafletMap
            destination={navigationState?.destination_metadata}
            isTracking={isTracking}
          />
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-card">
          <h3>Exhibit {currentExhibit} of {totalExhibits}</h3>
          <div className="progress-dots">
            {[1,2,3,4,5,6].map(i => (
              <div
                key={i}
                className={`progress-dot ${i <= currentExhibit ? 'active' : ''} ${i === currentExhibit ? 'current' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="location-info">
        <div className="location-row">
          <span className="location-dot current"></span>
          <span>Current Location</span>
          <span className="location-dot path"></span>
          <span>Path Exhibits</span>
        </div>
      </div>

      <div className="navigation-stats">
        <div className="stat-item">
          <span className="stat-icon">📍</span>
          <span>Distance: {Math.round(Math.max(0, 76 - totalDistance))}m (Live)</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">👣</span>
          <span>Steps: ~{Math.max(0, 147 - stepCount)} (Tracked: {stepCount})</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🧭</span>
          <span>Direction: {currentDirection} (Live)</span>
        </div>
        {isTracking && (
          <div className="stat-item">
            <span className="stat-icon">🚶</span>
            <span>Total Distance: {totalDistance.toFixed(1)}m</span>
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default AINavigation;