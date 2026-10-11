import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AINavigation.css';
import LeafletMap from './LeafletMap';
import { CIT_FLOOR_LABELS, getDestinationRoute, getNode } from '../navigation/citIndoorRoute.js';
import { getCITWalkthroughEvidence } from '../navigation/citWalkthroughEvidence.js';
import IndoorNavigationState from '../services/indoorNavigationState.js';
import { handleSpeechInteraction, textToSpeech } from '../services/speechAPI.js';

const NAV_LANGUAGE = {
  en: { language: 'Language', title: 'Indoor directions', start: 'Starting point', destination: 'Destination', previous: 'Previous', next: 'Next', confirm: 'Confirm landmark', arrived: 'Arrived', steps: 'Steps', map: 'Map', from: 'Starting from', to: 'Going to', explore: 'Explore', back: 'Go back', mute: 'Mute', unmute: 'Unmute', collapse: 'Collapse', expand: 'Expand' },
  tl: { language: 'Wika', title: 'Gabay sa loob ng gusali', start: 'Panimulang lokasyon', destination: 'Pupuntahan', previous: 'Nakaraan', next: 'Susunod', confirm: 'Kumpirmahin ang palatandaan', arrived: 'Nakarating na', steps: 'Mga hakbang', map: 'Mapa', from: 'Mula sa', to: 'Papunta sa', explore: 'Tuklasin ang', back: 'Bumalik', mute: 'I-mute', unmute: 'I-unmute', collapse: 'Itago', expand: 'Ipakita' },
  zh: { language: '语言', title: '室内导航', start: '起点', destination: '目的地', previous: '上一步', next: '下一步', confirm: '确认地标', arrived: '已到达', steps: '步骤', map: '地图', from: '出发地', to: '前往', explore: '探索', back: '返回', mute: '静音', unmute: '取消静音', collapse: '收起', expand: '展开' },
};
const NAV_INSTRUCTIONS = {
  "tl": {
    "At the CIT Entrance, go right toward the EMH Department.": "Sa pasukan ng CIT, kumanan papunta sa EMH Department.",
    "Continue to the EMH Department.": "Magpatuloy papunta sa EMH Department.",
    "At the EMH Bulletin Board, turn left.": "Sa bulletin board ng EMH, kumaliwa.",
    "Enter the small passage and turn right.": "Pumasok sa makitid na daanan at kumanan.",
    "Continue to the elevator on the 1st floor.": "Magpatuloy sa elevator sa unang palapag.",
    "Take the elevator to the 4th floor, then follow the angled approach toward OLCPD.": "Sumakay sa elevator papunta sa ikaapat na palapag, pagkatapos ay sundan ang pahilis na daan papunta sa OLCPD.",
    "At OLCPD, turn right.": "Sa OLCPD, kumanan.",
    "At the window near the restroom, turn left.": "Sa bintanang malapit sa palikuran, kumaliwa.",
    "Continue straight along the hallway.": "Dumiretso sa pasilyo.",
    "Pass the OVPREI Office.": "Dumaan sa tapat ng tanggapan ng OVPREI.",
    "Arrive at ARICC.": "Nakarating na kayo sa ARICC.",
    "Use ARICC as the nearest reference landmark, then continue toward RIO.": "Gamitin ang ARICC bilang pinakamalapit na palatandaan, pagkatapos ay magpatuloy papunta sa RIO.",
    "Continue to the RIO entrance.": "Magpatuloy papunta sa pasukan ng RIO.",
    "Continue straight toward FABLAB.": "Dumiretso papunta sa FABLAB.",
    "Continue to the FABLAB entrance.": "Magpatuloy papunta sa pasukan ng FABLAB.",
    "Proceed toward the stairs near FABLAB.": "Pumunta sa hagdang malapit sa FABLAB.",
    "Turn right toward CAESAR.": "Kumanan papunta sa CAESAR.",
    "Continue toward the CAESAR entrance.": "Magpatuloy papunta sa pasukan ng CAESAR.",
    "Arrive at CAESAR.": "Nakarating na kayo sa CAESAR.",
    "At the 4th-floor elevator, turn right and go straight.": "Sa elevator sa ikaapat na palapag, kumanan at dumiretso.",
    "Continue along the corridor toward RECON.": "Magpatuloy sa pasilyo papunta sa RECON.",
    "Continue straight past the pot and restroom-side doors.": "Dumiretso, lampasan ang paso at mga pintuang malapit sa palikuran.",
    "Follow the corridor through the two right turns.": "Sundan ang pasilyo at kumanan nang dalawang beses.",
    "Arrive at RECON.": "Nakarating na kayo sa RECON.",
    "Continue from the ARICC area toward the RIO entrance.": "Mula sa ARICC, magpatuloy papunta sa pasukan ng RIO.",
    "You have reached RIO. Continue straight along the corridor toward FABLAB.": "Nakarating na kayo sa RIO. Dumiretso sa pasilyo papunta sa FABLAB.",
    "From FABLAB, proceed toward the stairs.": "Mula sa FABLAB, magpatuloy papunta sa hagdan.",
    "At the stairs near FABLAB, turn right toward CAESAR.": "Sa hagdang malapit sa FABLAB, kumanan papunta sa CAESAR.",
    "Continue toward CAESAR.": "Magpatuloy papunta sa CAESAR.",
    "At the CAESAR entrance.": "Nasa pasukan na kayo ng CAESAR.",
    "Continue straight, then turn right at the corridor corner.": "Dumiretso, pagkatapos ay kumanan sa kanto ng pasilyo.",
    "Turn right toward the RECON entrance.": "Kumanan papunta sa pasukan ng RECON.",
    "Arrive at RIO.": "Nakarating na kayo sa RIO.",
    "Arrive at FABLAB.": "Nakarating na kayo sa FABLAB."
  },
  "zh": {
    "At the CIT Entrance, go right toward the EMH Department.": "在 CIT 入口处右转，前往 EMH 部门。",
    "Continue to the EMH Department.": "继续前往 EMH 部门。",
    "At the EMH Bulletin Board, turn left.": "在 EMH 公告栏处左转。",
    "Enter the small passage and turn right.": "进入狭窄通道，然后右转。",
    "Continue to the elevator on the 1st floor.": "继续前往一楼的电梯。",
    "Take the elevator to the 4th floor, then follow the angled approach toward OLCPD.": "乘电梯到四楼，然后沿斜向通道前往 OLCPD。",
    "At OLCPD, turn right.": "在 OLCPD 处右转。",
    "At the window near the restroom, turn left.": "在洗手间附近的窗户处左转。",
    "Continue straight along the hallway.": "沿走廊直走。",
    "Pass the OVPREI Office.": "经过 OVPREI 办公室。",
    "Arrive at ARICC.": "您已到达 ARICC。",
    "Use ARICC as the nearest reference landmark, then continue toward RIO.": "以 ARICC 为最近的参考地标，然后继续前往 RIO。",
    "Continue to the RIO entrance.": "继续前往 RIO 入口。",
    "Continue straight toward FABLAB.": "直走前往 FABLAB。",
    "Continue to the FABLAB entrance.": "继续前往 FABLAB 入口。",
    "Proceed toward the stairs near FABLAB.": "前往 FABLAB 附近的楼梯。",
    "Turn right toward CAESAR.": "右转前往 CAESAR。",
    "Continue toward the CAESAR entrance.": "继续前往 CAESAR 入口。",
    "Arrive at CAESAR.": "您已到达 CAESAR。",
    "At the 4th-floor elevator, turn right and go straight.": "在四楼电梯处右转，然后直走。",
    "Continue along the corridor toward RECON.": "沿走廊继续前往 RECON。",
    "Continue straight past the pot and restroom-side doors.": "直走，经过花盆和洗手间旁的门。",
    "Follow the corridor through the two right turns.": "沿走廊连续右转两次。",
    "Arrive at RECON.": "您已到达 RECON。",
    "Continue from the ARICC area toward the RIO entrance.": "从 ARICC 区域继续前往 RIO 入口。",
    "You have reached RIO. Continue straight along the corridor toward FABLAB.": "您已到达 RIO。沿走廊直走前往 FABLAB。",
    "From FABLAB, proceed toward the stairs.": "从 FABLAB 前往楼梯。",
    "At the stairs near FABLAB, turn right toward CAESAR.": "在 FABLAB 附近的楼梯处右转前往 CAESAR。",
    "Continue toward CAESAR.": "继续前往 CAESAR。",
    "At the CAESAR entrance.": "您已来到 CAESAR 入口。",
    "Continue straight, then turn right at the corridor corner.": "直走，然后在走廊转角右转。",
    "Turn right toward the RECON entrance.": "右转前往 RECON 入口。",
    "Arrive at RIO.": "您已到达 RIO。",
    "Arrive at FABLAB.": "您已到达 FABLAB。"
  }
};
const NAV_LANDMARKS = {
  "tl": {
    "CIT Entrance": "Pasukan ng CIT",
    "EMH Department": "Departamento ng EMH",
    "EMH Bulletin Board": "Bulletin board ng EMH",
    "Small passage": "Makitid na daanan",
    "Elevator": "Elevator",
    "OLCPD": "OLCPD",
    "Window near restroom": "Bintana malapit sa palikuran",
    "Hallway": "Pasilyo",
    "OVPREI Office": "Tanggapan ng OVPREI",
    "ARICC area toward RIO": "Lugar ng ARICC papunta sa RIO",
    "ARICC area": "Lugar ng ARICC",
    "Corridor after RIO": "Pasilyo pagkatapos ng RIO",
    "Corridor windows": "Mga bintana sa pasilyo",
    "Stairs near FABLAB": "Hagdan malapit sa FABLAB",
    "CAESAR turn point": "Likuan papunta sa CAESAR",
    "CAESAR approach": "Daan papunta sa CAESAR",
    "4th-floor elevator": "Elevator sa ikaapat na palapag",
    "RECON corridor": "Pasilyo papunta sa RECON",
    "Pot / restroom area": "Lugar ng paso at palikuran",
    "RECON approach": "Daan papunta sa RECON",
    "1st Floor Elevator": "Elevator sa unang palapag",
    "4th Floor Elevator": "Elevator sa ikaapat na palapag",
    "4th Floor Hallway": "Pasilyo sa ikaapat na palapag",
    "1st Floor": "Unang palapag",
    "4th Floor": "Ikaapat na palapag"
  },
  "zh": {
    "CIT Entrance": "CIT 入口",
    "EMH Department": "EMH 部门",
    "EMH Bulletin Board": "EMH 公告栏",
    "Small passage": "狭窄通道",
    "Elevator": "电梯",
    "OLCPD": "OLCPD",
    "Window near restroom": "洗手间附近的窗户",
    "Hallway": "走廊",
    "OVPREI Office": "OVPREI 办公室",
    "ARICC area toward RIO": "ARICC 至 RIO 区域",
    "ARICC area": "ARICC 区域",
    "Corridor after RIO": "RIO 后方走廊",
    "Corridor windows": "走廊窗户",
    "Stairs near FABLAB": "FABLAB 附近楼梯",
    "CAESAR turn point": "CAESAR 转弯处",
    "CAESAR approach": "通往 CAESAR 的道路",
    "4th-floor elevator": "四楼电梯",
    "RECON corridor": "RECON 走廊",
    "Pot / restroom area": "花盆与洗手间区域",
    "RECON approach": "通往 RECON 的道路",
    "1st Floor Elevator": "一楼电梯",
    "4th Floor Elevator": "四楼电梯",
    "4th Floor Hallway": "四楼走廊",
    "1st Floor": "一楼",
    "4th Floor": "四楼"
  }
};
const localizedInstruction = (text, language) => language === 'en' || !text ? text : (NAV_INSTRUCTIONS[language]?.[text] || text);
const localizedLandmark = (text, language) => language === 'en' || !text ? text : (NAV_LANDMARKS[language]?.[text] || text);
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

function NavigationAvatar({ event, instruction, language, labels, muted, onMute, expanded, onToggle }) {
  const [speaking, setSpeaking] = useState(false);
  const previousEvent = useRef('');

  useEffect(() => {
    if (muted || !instruction || previousEvent.current === `${language}:${event}:${instruction}`) return undefined;
    previousEvent.current = `${language}:${event}:${instruction}`;
    let active = true;
    setSpeaking(true);
    handleSpeechInteraction();
    textToSpeech(instruction, false, 'taylor', language).finally(() => {
      if (active) setSpeaking(false);
    });
    return () => { active = false; };
  }, [event, instruction, language, muted]);

  return <aside className={`navigation-avatar-panel ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="TAYLOR navigation guide">
    <div className="navigation-avatar-toolbar">
      <strong>{language === 'tl' ? 'Gabay ni TAYLOR' : language === 'zh' ? 'TAYLOR 导航助手' : 'TAYLOR guide'}</strong>
      <div>
        <button type="button" onClick={onMute} aria-label={muted ? 'Unmute TAYLOR' : 'Mute TAYLOR'}>{muted ? labels.unmute : labels.mute}</button>
        <button type="button" onClick={onToggle} aria-expanded={expanded}>{expanded ? labels.collapse : labels.expand}</button>
      </div>
    </div>
    {expanded && <>
      <div className="navigation-avatar-stage">
        <NavigationAvatarBoundary>
          <Suspense fallback={<div className="navigation-avatar-loading">{language === 'tl' ? 'Inihahanda ang avatar…' : language === 'zh' ? '正在准备虚拟助手…' : 'Preparing avatar…'}</div>}>
            <Hologram emotion={event === 'ARRIVED' ? 'happy' : 'neutral'} isAnimating={speaking || event !== 'IDLE'} spokenText={instruction || ''} disableAnimations={false} poseMode={eventPose[event] || 'neutral'} assetPreset="idle" />
          </Suspense>
        </NavigationAvatarBoundary>
      </div>
      <p className="navigation-avatar-status" aria-live="polite">{instruction || (language === 'tl' ? 'Naghihintay ng kumpirmadong palatandaan.' : language === 'zh' ? '正在等待确认导航地标。' : 'Waiting for a confirmed navigation landmark.')}</p>
    </>}
  </aside>;
}

function StepPhoto({ evidence, landmark, language }) {
  if (evidence.verified && evidence.photo) return <img className="navigation-photo" src={evidence.photo} alt={landmark} />;
  return <div className="navigation-photo navigation-photo--placeholder" role="img" aria-label={`Verified photograph pending for ${landmark}`}><span>{language === 'tl' ? 'WALA PANG LARAWAN' : language === 'zh' ? '照片待补充' : 'PHOTO PENDING'}</span><small>{language === 'tl' ? 'Naghihintay ng napatunayang larawan ng CIT' : language === 'zh' ? '等待已核实的 CIT 路线画面' : 'Awaiting verified CIT walkthrough frame'}</small></div>;
}

export default function AINavigation({ onBack }) {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => {
    try { const saved = window.localStorage.getItem('taylorLanguage'); return ['en', 'tl', 'zh'].includes(saved) ? saved : 'en'; }
    catch { return 'en'; }
  });
  const labels = NAV_LANGUAGE[language] || NAV_LANGUAGE.en;
  const changeLanguage = (next) => {
    setLanguage(next);
    try { window.localStorage.setItem('taylorLanguage', next); } catch {}
  };
  const [selectedDestination, setSelectedDestination] = useState('ARICC');
  const [manualLocation, setManualLocation] = useState('manual-cit-entrance');
  const [currentStep, setCurrentStep] = useState(1);
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
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
  const direction = destinationConfirmed && currentStep === route.steps.length
    ? 'arrival'
    : (step?.transition || node.id.startsWith('elevator-') ? 'elevator' : evidence.turn || 'straight');
  const instruction = destinationConfirmed && currentStep === route.steps.length
    ? route.arrivalInstruction || step?.instruction
    : step?.instruction;
  const destination = TOUR_CENTERS[selectedDestination];
  const displayInstruction = localizedInstruction(instruction, language);

  useEffect(() => {
    navigationStateRef.current = new IndoorNavigationState({ destination: selectedDestination, startFloor: location.floor, targetFloor: 4 });
    setCurrentStep(1);
    setDestinationConfirmed(false);
    setNavigationEvent('START');
  }, [selectedDestination, location.floor]);

  const getNavigationEvent = (nextDirection, nextStep) => {
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
    const nextDirection = destinationConfirmed && bounded === route.steps.length ? 'arrival' : (nextRouteStep?.transition || nextNode.id.startsWith('elevator-') ? 'elevator' : nextEvidence.turn || 'straight');
    setNavigationEvent(getNavigationEvent(nextDirection, bounded));
  }

  function updateLocation(event) {
    const next = LOCATION_OPTIONS.find((option) => option.value === event.target.value) || LOCATION_OPTIONS[0];
    setManualLocation(next.value);
    setCurrentStep(next.step);
    setDestinationConfirmed(false);
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
    const confirmedLandmark = node.id === 'elevator-1f' ? 'elevator' : node.landmark;
    const confirmation = navigationStateRef.current?.confirmLandmark(confirmedLandmark);
    const isDestination = confirmation?.state?.current_landmark === selectedDestination;
    if (isDestination) {
      setDestinationConfirmed(true);
      setNavigationEvent('ARRIVED');
      return;
    }
    if (confirmation?.state?.last_confirmed_landmark && currentStep < route.steps.length) {
      goToStep(currentStep + 1);
    } else {
      setNavigationEvent('UNCERTAIN');
    }
  };

  return <div className="ai-navigation-container navigation-mobile-shell">
    <main className="navigation-mobile-page">
      <header className="navigation-mobile-header"><button className="navigation-icon-button" onClick={onBack || (() => navigate(-1))} aria-label={labels.back}>‹</button><div><span className="navigation-kicker">TAYLOR AI</span><h1>{labels.title}</h1></div><button className="navigation-map-button" onClick={() => setMapOpen((open) => !open)}>{mapOpen ? labels.steps : labels.map}</button></header>
      <section className="navigation-route-picker"><label>{labels.language}<select aria-label={labels.language} value={language} onChange={(event) => changeLanguage(event.target.value)}><option value="en">English</option><option value="tl">Filipino (Tagalog)</option><option value="zh">中文 (Mandarin)</option></select></label><label>{labels.start}<select value={manualLocation} onChange={updateLocation}>{LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{localizedLandmark(option.label, language)}</option>)}</select></label><label>{labels.destination}<select value={selectedDestination} onChange={(event) => { setSelectedDestination(event.target.value); setCurrentStep(1); }}><option>ARICC</option><option>RIO</option><option>FABLAB</option><option>CAESAR</option><option>RECON</option></select></label><div className="navigation-route-summary"><div><span>{labels.from}</span><strong>{localizedLandmark(location.label, language)}</strong></div><div><span>{labels.to}</span><strong>{selectedDestination}</strong></div></div></section>
      <NavigationAvatar event={navigationEvent} instruction={displayInstruction} language={language} labels={labels} muted={avatarMuted} onMute={() => setAvatarMuted((muted) => !muted)} expanded={avatarExpanded} onToggle={() => setAvatarExpanded((expanded) => !expanded)} />
      {mapOpen ? <section className="navigation-published-map" aria-label={language === 'tl' ? 'Mapa ng CIT' : language === 'zh' ? 'CIT 地图' : 'Geographic CIT map'}><LeafletMap destination={{ destination: selectedDestination }} isTracking /></section> : <section className={`navigation-step-view ${['RIO', 'ARICC', 'OVPREI', 'FABLAB', 'CAESAR'].includes(selectedDestination) ? 'navigation-step-view--rio' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-live="polite"><div className="navigation-progress"><span>{language === 'tl' ? 'HAKBANG' : language === 'zh' ? '步骤' : 'STEP'} {currentStep} {language === 'tl' ? 'SA' : language === 'zh' ? '/' : 'OF'} {route.steps.length}</span><div>{route.steps.map((item, index) => <i className={index + 1 <= currentStep ? 'is-complete' : ''} key={item.id} />)}</div></div><StepPhoto evidence={evidence} landmark={localizedLandmark(node.landmark, language)} language={language} /><div className="navigation-step-content"><div className={`navigation-direction navigation-direction--${direction}`}><strong>{directionIcon[direction]}</strong><span>{language === 'tl' ? ({arrival:'Pagdating',elevator:'Paglipat ng palapag',left:'Kaliwa',right:'Kanan',straight:'Diretso'}[direction] || direction) : language === 'zh' ? ({arrival:'到达',elevator:'楼层切换',left:'左转',right:'右转',straight:'直走'}[direction] || direction) : (direction === 'arrival' ? 'Arrive' : direction === 'elevator' ? 'Floor change' : direction)}</span></div><div className="navigation-step-meta"><span>{localizedLandmark(CIT_FLOOR_LABELS[step.floor], language)}</span><span>{evidence.verified ? `${evidence.sourceVideo} · ${evidence.timestamp}` : (language === 'tl' ? 'Sinusuri pa ang ebidensiya' : language === 'zh' ? '证据待审核' : 'Evidence pending review')}</span></div><h2>{localizedLandmark(node.landmark, language)}</h2><p>{displayInstruction}</p><small className="navigation-confidence">{evidence.verified ? `${language === 'tl' ? 'Napatunayang ebidensiya' : language === 'zh' ? '已核实的路线证据' : 'Verified walkthrough evidence'} · ${language === 'tl' ? ({high:'mataas',medium:'katamtaman','medium-high':'katamtaman hanggang mataas'}[evidence.confidence] || evidence.confidence) : language === 'zh' ? ({high:'高可信度',medium:'中等可信度','medium-high':'中高可信度'}[evidence.confidence] || evidence.confidence) : `${evidence.confidence} confidence`}` : (language === 'tl' ? 'Pansamantala ang hakbang hanggang makumpirma ang larawan.' : language === 'zh' ? '在路线画面核实前，此步骤仍为暂定。' : 'Neutral step retained until a walkthrough frame is verified.')}</small>{!route.complete && <small className="navigation-route-incomplete">{language === 'tl' ? `Hindi pa kumpleto ang ruta papunta sa ${route.destination}. Hindi pa kumpirmado ang pagdating.` : language === 'zh' ? `前往 ${route.destination} 的路线尚未完整，无法确认抵达。` : `Route to ${route.destination} is incomplete after this verified step. Arrival is not reported.`}</small>}</div></section>}
      <nav className="navigation-step-controls"><button type="button" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>{labels.previous}</button><button type="button" onClick={confirmCurrentLandmark}>{labels.confirm}</button><button type="button" className="navigation-next-button" onClick={() => goToStep(currentStep + 1)} disabled={currentStep === route.steps.length}>{route.complete && currentStep === route.steps.length ? labels.arrived : labels.next}</button></nav>
      <footer className="navigation-footer"><span>{language === 'tl' ? 'Manu-manong gabay · walang GPS o kamera' : language === 'zh' ? '手动导航 · 无 GPS 或摄像头' : 'Manual navigation · no GPS or camera'}</span><button type="button" onClick={() => navigate(destination.route, { state: { activeCenter: selectedDestination, tourMode: true } })}>{labels.explore} {selectedDestination}</button></footer>
    </main>
  </div>;
}
