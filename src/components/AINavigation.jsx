import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMaximize2 } from 'react-icons/fi';
import './AINavigation.css';
import { getPerformanceSettings } from '../services/devicePerformance.js';
const LeafletMap = lazy(() => import('./LeafletMap'));
import { CIT_FLOOR_LABELS, getDestinationRoute, getNode } from '../navigation/citIndoorRoute.js';
import { getCITWalkthroughEvidence } from '../navigation/citWalkthroughEvidence.js';
import IndoorNavigationState from '../services/indoorNavigationState.js';
import { textToSpeech } from '../services/speechAPI.js';

const NAV_LANGUAGE = {
  en: { language: 'Language', title: 'Indoor directions', start: 'Starting point', destination: 'Destination', previous: 'Previous', next: 'Next', confirm: 'Confirm landmark', arrived: 'Arrived', steps: 'Steps', map: 'Map', from: 'Starting from', to: 'Going to', scan: 'Scan exhibit', back: 'Go back', mute: 'Mute', unmute: 'Unmute', collapse: 'Collapse', expand: 'Expand' },
  tl: { language: 'Wika', title: 'Gabay sa loob ng gusali', start: 'Panimulang lokasyon', destination: 'Pupuntahan', previous: 'Nakaraan', next: 'Susunod', confirm: 'Kumpirmahin ang palatandaan', arrived: 'Nakarating na', steps: 'Mga hakbang', map: 'Mapa', from: 'Mula sa', to: 'Papunta sa', scan: 'I-scan ang exhibit', back: 'Bumalik', mute: 'I-mute', unmute: 'I-unmute', collapse: 'Itago', expand: 'Ipakita' },
  zh: { language: '语言', title: '室内导航', start: '起点', destination: '目的地', previous: '上一步', next: '下一步', confirm: '确认地标', arrived: '已到达', steps: '步骤', map: '地图', from: '出发地', to: '前往', scan: '扫描展览', back: '返回', mute: '静音', unmute: '取消静音', collapse: '收起', expand: '展开' },
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
    "Arrive at FABLAB.": "Nakarating na kayo sa FABLAB.",
    "Continue up the stairs to the 2nd floor.": "Umakyat sa hagdan papunta sa ika-2 palapag.",
    "Use the Dean's Office as your landmark, then turn left into the U-shaped stairwell.": "Gawing palatandaan ang Tanggapan ng Dean, pagkatapos ay kumaliwa papunta sa hagdanang hugis U.",
    "At the Dean's Office, turn left through the U-shaped stairwell.": "Sa Tanggapan ng Dean, kumaliwa sa hagdanang hugis U.",
    "Climb the next flight to the 3rd floor.": "Umakyat sa susunod na hagdan papunta sa ika-3 palapag.",
    "On the 3rd floor, turn right.": "Sa ika-3 palapag, kumanan.",
    "Go straight through the EEC Department corridor.": "Dumiretso sa pasilyo ng Departamento ng EEC.",
    "Continue straight to the TEECS Bulletin Board.": "Dumiretso papunta sa bulletin board ng TEECS.",
    "Near the TEECS Bulletin Board, turn right.": "Malapit sa bulletin board ng TEECS, kumanan.",
    "Go straight along the corridor.": "Dumiretso sa pasilyo.",
    "After the last bench, turn left and go toward the stairs.": "Pagkatapos ng huling bangko, kumaliwa at pumunta papunta sa hagdan.",
    "Go up to the 4th floor via the stairs.": "Umakyat sa ika-4 na palapag gamit ang hagdan.",
    "After reaching the 4th floor, turn left and go straight.": "Pagdating sa ika-4 na palapag, kumaliwa at dumiretso.",
    "The first door on your right is CAESAR.": "Ang unang pinto sa iyong kanan ay CAESAR.",
    "After reaching the 4th floor, go straight along the corridor.": "Pagdating sa ika-4 na palapag, dumiretso sa pasilyo.",
    "The first door on your left is FABLAB.": "Ang unang pinto sa iyong kaliwa ay FABLAB.",
    "Go straight along the corridor. The nearest landmark is the RIO Office.": "Dumiretso sa pasilyo. Ang pinakamalapit na palatandaan ay ang Tanggapan ng RIO.",
    "Look for the plaque near ARICC.": "Hanapin ang plake malapit sa ARICC.",
    "Continue to the ARICC entrance.": "Magpatuloy papunta sa pasukan ng ARICC.",
    "Use FABLAB as the nearest landmark, then continue straight along the corridor.": "Gawing pinakamalapit na palatandaan ang FABLAB, pagkatapos ay dumiretso sa pasilyo.",
    "The second door on your right is RIO.": "Ang ikalawang pinto sa iyong kanan ay RIO.",
    "When you reach the window near the restroom, turn left.": "Pagdating sa bintana malapit sa palikuran, kumaliwa.",
    "Use the male's restroom as your nearest landmark, then turn right.": "Gawing pinakamalapit na palatandaan ang palikuran ng lalaki, pagkatapos ay kumanan.",
    "Turn right toward RECON.": "Kumanan papunta sa RECON.",
    "Continue straight. The male's restroom will be on your left as the nearest landmark.": "Dumiretso. Ang palikuran ng lalaki ay nasa iyong kaliwa bilang pinakamalapit na palatandaan.",
    "Near OLCPD office, continue toward the corridor.": "Malapit sa tanggapan ng OLCPD, magpatuloy papunta sa pasilyo."
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
    "Arrive at FABLAB.": "您已到达 FABLAB。",
    "Continue up the stairs to the 2nd floor.": "沿楼梯上到二楼。",
    "Use the Dean's Office as your landmark, then turn left into the U-shaped stairwell.": "以院长办公室为地标，然后左转进入 U 形楼梯间。",
    "At the Dean's Office, turn left through the U-shaped stairwell.": "在院长办公室处左转，经过 U 形楼梯间。",
    "Climb the next flight to the 3rd floor.": "继续上楼到三楼。",
    "On the 3rd floor, turn right.": "在三楼右转。",
    "Go straight through the EEC Department corridor.": "直走穿过 EEC 部门走廊。",
    "Continue straight to the TEECS Bulletin Board.": "直走前往 TEECS 公告栏。",
    "Near the TEECS Bulletin Board, turn right.": "在 TEECS 公告栏附近右转。",
    "Go straight along the corridor.": "沿走廊直走。",
    "After the last bench, turn left and go toward the stairs.": "经过最后一张长椅后左转，前往楼梯。",
    "Go up to the 4th floor via the stairs.": "沿楼梯上到四楼。",
    "After reaching the 4th floor, turn left and go straight.": "到达四楼后左转并直走。",
    "The first door on your right is CAESAR.": "右侧第一扇门是 CAESAR。",
    "After reaching the 4th floor, go straight along the corridor.": "到达四楼后沿走廊直走。",
    "The first door on your left is FABLAB.": "左侧第一扇门是 FABLAB。",
    "Go straight along the corridor. The nearest landmark is the RIO Office.": "沿走廊直走。最近的地标是 RIO 办公室。",
    "Look for the plaque near ARICC.": "寻找 ARICC 附近的牌匾。",
    "Continue to the ARICC entrance.": "继续前往 ARICC 入口。",
    "Use FABLAB as the nearest landmark, then continue straight along the corridor.": "以 FABLAB 为最近的地标，然后沿走廊直走。",
    "The second door on your right is RIO.": "右侧第二扇门是 RIO。",
    "When you reach the window near the restroom, turn left.": "到达洗手间附近的窗户后左转。",
    "Use the male's restroom as your nearest landmark, then turn right.": "以男洗手间为最近的地标，然后右转。",
    "Turn right toward RECON.": "右转前往 RECON。",
    "Continue straight. The male's restroom will be on your left as the nearest landmark.": "直走，男洗手间会在你的左侧，作为最近的地标。",
    "Near OLCPD office, continue toward the corridor.": "在 OLCPD 办公室附近继续前往走廊。"
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
    "4th Floor": "Ikaapat na palapag",
    "Stairs to 2nd floor": "Hagdan papunta sa ika-2 palapag",
    "Dean's Office": "Tanggapan ng Dean",
    "U-shaped stair turn": "Hagdanang hugis U",
    "Stairs to 3rd floor": "Hagdan papunta sa ika-3 palapag",
    "3rd-floor right turn": "Kanan sa ika-3 palapag",
    "EEC Department": "Departamento ng EEC",
    "TEECS Bulletin Board": "Bulletin board ng TEECS",
    "TEECS right turn": "Kanan sa TEECS",
    "Corridor after right turn": "Pasilyo pagkatapos ng kanan",
    "Last bench": "Huling bangko",
    "Stairs toward 4th floor": "Hagdan papunta sa ika-4 na palapag",
    "4th-floor stair landing": "Landing ng hagdan sa ika-4 na palapag",
    "First door on the right": "Unang pinto sa kanan",
    "First door on the left": "Unang pinto sa kaliwa",
    "RIO Office": "Tanggapan ng RIO",
    "ARICC plaque": "Plake ng ARICC",
    "ARICC entrance": "Pasukan ng ARICC",
    "Second door on the right": "Ikalawang pinto sa kanan",
    "Male's restroom": "Palikuran ng lalaki",
    "RECON right turn": "Kanan papunta sa RECON",
    "RECON": "RECON"
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
    "4th Floor": "四楼",
    "Stairs to 2nd floor": "通往二楼的楼梯",
    "Dean's Office": "院长办公室",
    "U-shaped stair turn": "U 形楼梯转弯处",
    "Stairs to 3rd floor": "通往三楼的楼梯",
    "3rd-floor right turn": "三楼右转处",
    "EEC Department": "EEC 部门",
    "TEECS Bulletin Board": "TEECS 公告栏",
    "TEECS right turn": "TEECS 右转处",
    "Corridor after right turn": "右转后的走廊",
    "Last bench": "最后一张长椅",
    "Stairs toward 4th floor": "通往四楼的楼梯",
    "4th-floor stair landing": "四楼楼梯平台",
    "First door on the right": "右侧第一扇门",
    "First door on the left": "左侧第一扇门",
    "RIO Office": "RIO 办公室",
    "ARICC plaque": "ARICC 牌匾",
    "ARICC entrance": "ARICC 入口",
    "Second door on the right": "右侧第二扇门",
    "Male's restroom": "男洗手间",
    "RECON right turn": "通往 RECON 的右转处",
    "RECON": "RECON"
  }
};
const localizedInstruction = (text, language) => language === 'en' || !text ? text : (NAV_INSTRUCTIONS[language]?.[text] || text);
const localizedLandmark = (text, language) => language === 'en' || !text ? text : (NAV_LANDMARKS[language]?.[text] || text);
const Hologram = lazy(() => import('../hologram.jsx'));

const TOUR_CENTERS = {
  ARICC: { fullName: 'Advanced Robotics and Intelligent Control Center', location: 'CIT - 4th Floor', route: '/machine-vision-aricc' },
  ARICC_STAIRS: { fullName: 'Advanced Robotics and Intelligent Control Center (stairs route)', location: 'CIT - 4th Floor', route: '/machine-vision-aricc' },
  RIO: { fullName: 'Research and Innovation Office', location: 'CIT - 4th Floor', route: '/machine-vision-rio' },
  RIO_STAIRS: { fullName: 'Research and Innovation Office (stairs route)', location: 'CIT - 4th Floor', route: '/machine-vision-rio' },
  FABLAB: { fullName: 'Center for Fabrication and Manufacture', location: 'CIT - 4th Floor', route: '/machine-vision-fablab' },
  FABLAB_STAIRS: { fullName: 'Center for Fabrication and Manufacture (stairs route)', location: 'CIT - 4th Floor', route: '/machine-vision-fablab' },
  CAESAR: { fullName: 'Center for Advanced Environmental Science and Agriculture Research', location: 'CIT - 4th Floor', route: '/machine-vision-caesar' },
  CAESAR_STAIRS: { fullName: 'Center for Advanced Environmental Science and Agriculture Research (stairs route)', location: 'CIT - 4th Floor', route: '/machine-vision-caesar' },
  RECON: { fullName: 'Resiliency Energy Continuity Center', location: 'CIT - 4th Floor', route: '/machine-vision-recon' },
  RECON_STAIRS: { fullName: 'Resiliency Energy Continuity Center (stairs route)', location: 'CIT - 4th Floor', route: '/machine-vision-recon' },
};
const SCANNABLE_DESTINATIONS = new Set(['ARICC', 'FABLAB', 'CAESAR', 'RECON']);
const LOCATION_OPTIONS = [
  { value: 'manual-cit-entrance', label: 'CIT Entrance', floor: 1, step: 1 },
  { value: 'manual-emh-department', label: 'EMH Department', floor: 1, step: 2 },
  { value: 'manual-elevator-1f', label: '1st Floor Elevator', floor: 1, step: 5 },
  { value: 'manual-4f-elevator', label: '4th Floor Elevator', floor: 4, step: 6 },
  { value: 'manual-olcpd', label: 'OLCPD', floor: 4, step: 7 },
  { value: 'manual-4f-hallway', label: '4th Floor Hallway', floor: 4, step: 9 },
  { value: 'stairs-cit-entrance', label: 'CIT Entrance', floor: 1, step: 1 },
  { value: 'stairs-deans-office', label: "2nd Floor Dean's Office", floor: 2, step: 2 },
  { value: 'stairs-eec-bulletin-board', label: 'EEC Department (Via the TEECS Bulletin Board)', floor: 3, step: 7 },
];
const STAIR_LOCATION_OPTIONS = [
  { value: 'stairs-cit-entrance', label: 'CIT Entrance', floor: 1, step: 1 },
  { value: 'stairs-deans-office', label: "2nd Floor Dean's Office", floor: 2, step: 2 },
  { value: 'stairs-eec-bulletin-board', label: 'EEC Department (Via the TEECS Bulletin Board)', floor: 3, step: 7 },
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
  const [show3D, setShow3D] = useState(() => getPerformanceSettings().avatar3D);
  const previousEvent = useRef('');

  useEffect(() => {
    if (muted || !instruction || previousEvent.current === `${language}:${event}:${instruction}`) return undefined;
    previousEvent.current = `${language}:${event}:${instruction}`;
    let active = true;
    setSpeaking(true);
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
        {show3D ? <NavigationAvatarBoundary>
          <Suspense fallback={<div className="navigation-avatar-loading">{language === 'tl' ? 'Inihahanda ang avatar…' : language === 'zh' ? '正在准备虚拟助手…' : 'Preparing avatar…'}</div>}>
            <Hologram emotion={event === 'ARRIVED' ? 'happy' : 'neutral'} isAnimating={speaking || event !== 'IDLE'} spokenText={instruction || ''} disableAnimations={false} poseMode={eventPose[event] || 'neutral'} assetPreset="idle" />
          </Suspense>
        </NavigationAvatarBoundary> : <div className="navigation-avatar-fallback" role="status">TAYLOR voice guidance is active. 3D avatar paused to save memory.</div>}
      </div>
      <button type="button" onClick={() => setShow3D(value => !value)}>{show3D ? 'Use lightweight avatar' : 'Enable 3D avatar'}</button>
      <p className="navigation-avatar-status" aria-live="polite">{instruction || (language === 'tl' ? 'Naghihintay ng kumpirmadong palatandaan.' : language === 'zh' ? '正在等待确认导航地标。' : 'Waiting for a confirmed navigation landmark.')}</p>
    </>}
  </aside>;
}

function StepPhoto({ evidence, landmark, language }) {
  if (evidence.verified && evidence.photo) return <img className={`navigation-photo navigation-photo--center-center${evidence.photo.endsWith('/second-floor-u-turn.jpg') ? ' navigation-photo--bottom-center' : ''}${evidence.photo.endsWith('/recon-stairs-right-turn.jpg') ? ' navigation-photo--top-center' : ''}`} src={evidence.photo} alt={landmark} />;
  return <div className="navigation-photo navigation-photo--placeholder" role="img" aria-label={`Verified photograph pending for ${landmark}`}><span>{language === 'tl' ? 'WALA PANG LARAWAN' : language === 'zh' ? '照片待补充' : 'PHOTO PENDING'}</span><small>{language === 'tl' ? 'Naghihintay ng napatunayang larawan ng CIT' : language === 'zh' ? '等待已核实的 CIT 路线画面' : 'Awaiting verified CIT walkthrough frame'}</small></div>;
}

export default function AINavigation({ onBack }) {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => {
    try { const saved = window.localStorage.getItem('taylorLanguage'); return ['en', 'tl', 'zh'].includes(saved) ? saved : 'en'; }
    catch { return 'en'; }
  });
  const labels = NAV_LANGUAGE[language] || NAV_LANGUAGE.en;
  const changeRouteMode = (nextMode) => {
    if (nextMode !== 'elevator' && nextMode !== 'stairs') return;
    if (nextMode === routeMode) return;
    // Clear arrival/progress in the same interaction before selecting a new route.
    setDestinationConfirmed(false);
    setCurrentStep(1);
    setNavigationEvent('START');
    navigationStateRef.current = null;
    setManualLocation(nextMode === 'stairs' ? STAIR_LOCATION_OPTIONS[0].value : LOCATION_OPTIONS[0].value);
    setRouteMode(nextMode);
  };
  const changeLanguage = (next) => {
    setLanguage(next);
    try { window.localStorage.setItem('taylorLanguage', next); } catch {}
  };
  const [selectedDestination, setSelectedDestination] = useState('ARICC');
  const [routeMode, setRouteMode] = useState('elevator');
  const routeDestination = routeMode === 'stairs' ? `${selectedDestination}_STAIRS` : selectedDestination;
  const [manualLocation, setManualLocation] = useState('manual-cit-entrance');
  const [currentStep, setCurrentStep] = useState(1);
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(true);
  const [avatarMuted, setAvatarMuted] = useState(false);
  const navigationStateRef = useRef(null);
  const [navigationEvent, setNavigationEvent] = useState('IDLE');
  const touchStart = useRef(null);
  const locationOptions = routeMode === 'stairs' ? STAIR_LOCATION_OPTIONS : LOCATION_OPTIONS;
  const location = locationOptions.find((option) => option.value === manualLocation) || locationOptions[0];
  const fullRoute = getDestinationRoute(routeDestination);
  const landmarkByOption = {
    'manual-cit-entrance': 'cit-entrance',
    'manual-emh-department': 'emh-department',
    'manual-elevator-1f': 'elevator-1f',
    'manual-4f-elevator': 'elevator-4f',
    'manual-olcpd': 'olcpd-office',
    'manual-4f-hallway': 'hallway-straight',
    'stairs-cit-entrance': 'second-floor-stairs',
    'stairs-deans-office': 'deans-office-2f',
    'stairs-eec-bulletin-board': 'teecs-department',
  };
  const startIndex = fullRoute.steps.findIndex((item) => item.from === landmarkByOption[manualLocation]);
  // Renumber the visible route from the visitor's selected starting point.
  // Never silently show CIT Entrance when a different start was requested.
  const startUnavailable = startIndex < 0;
  const route = {
    ...fullRoute,
    steps: startUnavailable ? [] : fullRoute.steps.slice(startIndex),
  };
  const selectedStartStep = 1;
  // Route changes render before the reset effect runs. Clamp synchronously so
  // the previous route's step index cannot dereference an absent step.
  const visibleStep = route.steps.length ? Math.min(Math.max(currentStep, 1), route.steps.length) : 1;
  const step = route.steps[visibleStep - 1];
  const node = step ? getNode(step.from) : null;
  const evidence = node ? getCITWalkthroughEvidence(node.id) : null;
  const atFinalStep = !startUnavailable && route.steps.length > 0 && visibleStep === route.steps.length;
  const direction = destinationConfirmed && atFinalStep
    ? 'arrival'
    : (step?.transition || node?.id?.startsWith('elevator-') ? 'elevator' : evidence?.turn || 'straight');
  const instruction = destinationConfirmed && atFinalStep
    ? route.arrivalInstruction || step?.instruction
    : step?.instruction;
  const destination = TOUR_CENTERS[selectedDestination];
  const displayInstruction = startUnavailable ? 'No verified route begins at this starting point for the selected destination and route option. Choose another starting point.' : localizedInstruction(instruction, language);

  useEffect(() => {
    navigationStateRef.current = new IndoorNavigationState({ destination: selectedDestination, startFloor: location.floor, targetFloor: 4 });
    setCurrentStep(selectedStartStep);
    setDestinationConfirmed(false);
    setNavigationEvent('START');
  }, [routeDestination, manualLocation]);

  const getNavigationEvent = (nextDirection, nextStep) => {
    if (nextDirection === 'left') return 'TURN_LEFT';
    if (nextDirection === 'right') return 'TURN_RIGHT';
    if (nextDirection === 'elevator') return 'WALK_FORWARD';
    return 'WALK_FORWARD';
  };

  function goToStep(nextStep) {
    if (startUnavailable || !route.steps.length || destinationConfirmed) return;
    const bounded = Math.min(Math.max(nextStep, 1), route.steps.length);
    if (startUnavailable || !route.steps.length || destinationConfirmed) return;
    setCurrentStep(bounded);
    const nextRouteStep = route.steps[bounded - 1];
    const nextNode = getNode(nextRouteStep?.from);
    const nextEvidence = getCITWalkthroughEvidence(nextNode.id);
    const nextDirection = destinationConfirmed && bounded === route.steps.length ? 'arrival' : (nextRouteStep?.transition || nextNode.id.startsWith('elevator-') ? 'elevator' : nextEvidence.turn || 'straight');
    setNavigationEvent(getNavigationEvent(nextDirection, bounded));
  }

  function updateLocation(event) {
    const next = locationOptions.find((option) => option.value === event.target.value) || locationOptions[0];
    setManualLocation(next.value);
    // The route effect resolves the correct step for this destination and landmark.
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
    if (startUnavailable || !route.steps.length || !step || destinationConfirmed) return;
    if (atFinalStep && (step?.from === 'fablab-entrance' || step?.from === 'aricc' || step?.from === 'rio-entrance' || step?.from === 'caesar' || step?.from === 'recon')) {
      setDestinationConfirmed(true);
      setNavigationEvent('ARRIVED');
      return;
    }
    const confirmedLandmark = node.id === 'elevator-1f' ? 'elevator' : node.landmark;
    const confirmation = navigationStateRef.current?.confirmLandmark(confirmedLandmark);
    const isDestination = confirmation?.state?.current_landmark === selectedDestination;
    if (isDestination) {
      setDestinationConfirmed(true);
      setNavigationEvent('ARRIVED');
      return;
    }
    if (confirmation?.state?.last_confirmed_landmark && visibleStep < route.steps.length) {
      goToStep(visibleStep + 1);
    } else {
      setNavigationEvent('UNCERTAIN');
    }
  };

  const scanRoute = SCANNABLE_DESTINATIONS.has(selectedDestination) ? destination.route : null;

  return <div className="ai-navigation-container navigation-mobile-shell">
    {scanRoute && <button
      type="button"
      className="navigation-scan-fab"
      onClick={() => navigate(scanRoute, { state: { activeCenter: selectedDestination } })}
      aria-label={`${labels.scan} ${selectedDestination}`}
      title={`${labels.scan} ${selectedDestination}`}
    >
      <FiMaximize2 aria-hidden="true" />
      <span>{labels.scan}</span>
    </button>}
    <main className="navigation-mobile-page">
      <header className="navigation-mobile-header"><button className="navigation-icon-button" onClick={onBack || (() => navigate('/taylor'))} aria-label={labels.back}>‹</button><div><span className="navigation-kicker">TAYLOR AI</span><h1>{labels.title}</h1></div><button className="navigation-map-button" onClick={() => setMapOpen((open) => !open)}>{mapOpen ? labels.steps : labels.map}</button></header>
      <section className="navigation-route-picker"><label>{labels.language}<select aria-label={labels.language} value={language} onChange={(event) => changeLanguage(event.target.value)}><option value="en">English</option><option value="tl">Filipino (Tagalog)</option><option value="zh">中文 (Mandarin)</option></select></label><label>{labels.start}<select value={manualLocation} onChange={updateLocation}>{locationOptions.map((option) => <option key={option.value} value={option.value}>{localizedLandmark(option.label, language)}</option>)}</select></label><label>{labels.destination}<select value={selectedDestination} onChange={(event) => { setSelectedDestination(event.target.value); setCurrentStep(1); }}><option value="ARICC">ARICC</option><option>RIO</option><option>FABLAB</option><option>CAESAR</option><option>RECON</option></select></label><label>{language === 'tl' ? 'DAANAN' : language === 'zh' ? '路线方式' : 'ROUTE OPTION'}<select aria-label={language === 'tl' ? 'Piliin ang elevator o hagdan' : language === 'zh' ? '选择电梯或楼梯' : 'Choose elevator or stairs'} value={routeMode} onChange={(event) => changeRouteMode(event.target.value)}><option value="elevator">{language === 'tl' ? 'Elevator' : language === 'zh' ? '电梯' : 'Elevator'}</option><option value="stairs">{language === 'tl' ? 'Hagdan' : language === 'zh' ? '楼梯' : 'Stairs'}</option></select></label><div className="navigation-route-summary"><div><span>{labels.from}</span><strong>{localizedLandmark(location.label, language)}</strong></div><div><span>{labels.to}</span><strong>{selectedDestination}</strong></div></div></section>
      <NavigationAvatar event={navigationEvent} instruction={displayInstruction} language={language} labels={labels} muted={avatarMuted} onMute={() => setAvatarMuted((muted) => !muted)} expanded={avatarExpanded} onToggle={() => setAvatarExpanded((expanded) => !expanded)} />
      {startUnavailable ? <section className="navigation-step-view" role="status" style={{ padding: 20 }}><h2>Starting point unavailable</h2><p>{displayInstruction}</p></section> : mapOpen ? <section className="navigation-published-map" aria-label={language === 'tl' ? 'Mapa ng CIT' : language === 'zh' ? 'CIT 地图' : 'Geographic CIT map'}><Suspense fallback={<div role="status">Loading map…</div>}><LeafletMap destination={{ destination: selectedDestination }} isTracking /></Suspense></section> : <section className={`navigation-step-view ${['RIO', 'ARICC', 'OVPREI', 'FABLAB', 'CAESAR'].includes(selectedDestination) ? 'navigation-step-view--rio' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-live="polite"><div className="navigation-progress"><span>{language === 'tl' ? 'HAKBANG' : language === 'zh' ? '步骤' : 'STEP'} {visibleStep} {language === 'tl' ? 'SA' : language === 'zh' ? '/' : 'OF'} {route.steps.length}</span><div>{route.steps.map((item, index) => <i className={index + 1 <= visibleStep ? 'is-complete' : ''} key={item.id} />)}</div></div><StepPhoto evidence={evidence} landmark={localizedLandmark(node.landmark, language)} language={language} /><div className="navigation-step-content"><div className={`navigation-direction navigation-direction--${direction}`}><strong>{directionIcon[direction]}</strong><span>{language === 'tl' ? ({arrival:'Pagdating',elevator:'Paglipat ng palapag',left:'Kaliwa',right:'Kanan',straight:'Diretso'}[direction] || direction) : language === 'zh' ? ({arrival:'到达',elevator:'楼层切换',left:'左转',right:'右转',straight:'直走'}[direction] || direction) : (direction === 'arrival' ? 'Arrive' : direction === 'elevator' ? 'Floor change' : direction)}</span></div><div className="navigation-step-meta"><span>{localizedLandmark(CIT_FLOOR_LABELS[step.floor], language)}</span><span>{evidence.verified ? `${evidence.sourceVideo} · ${evidence.timestamp}` : (language === 'tl' ? 'Sinusuri pa ang ebidensiya' : language === 'zh' ? '证据待审核' : 'Evidence pending review')}</span></div><h2>{localizedLandmark(node.landmark, language)}</h2><p>{displayInstruction}</p><small className="navigation-confidence">{evidence.verified ? `${language === 'tl' ? 'Napatunayang ebidensiya' : language === 'zh' ? '已核实的路线证据' : 'Verified walkthrough evidence'} · ${language === 'tl' ? ({high:'mataas',medium:'katamtaman','medium-high':'katamtaman hanggang mataas'}[evidence.confidence] || evidence.confidence) : language === 'zh' ? ({high:'高可信度',medium:'中等可信度','medium-high':'中高可信度'}[evidence.confidence] || evidence.confidence) : `${evidence.confidence} confidence`}` : (language === 'tl' ? 'Pansamantala ang hakbang hanggang makumpirma ang larawan.' : language === 'zh' ? '在路线画面核实前，此步骤仍为暂定。' : 'Neutral step retained until a walkthrough frame is verified.')}</small>{!route.complete && <small className="navigation-route-incomplete">{language === 'tl' ? `Hindi pa kumpleto ang ruta papunta sa ${route.destination}. Hindi pa kumpirmado ang pagdating.` : language === 'zh' ? `前往 ${route.destination} 的路线尚未完整，无法确认抵达。` : `Route to ${route.destination} is incomplete after this verified step. Arrival is not reported.`}</small>}</div></section>}
      <nav className="navigation-step-controls"><button type="button" onClick={() => goToStep(visibleStep - 1)} disabled={startUnavailable || destinationConfirmed || visibleStep === 1}>{labels.previous}</button><button type="button" onClick={confirmCurrentLandmark} disabled={startUnavailable || destinationConfirmed}>{labels.confirm}</button><button type="button" className="navigation-next-button" onClick={() => goToStep(currentStep + 1)} disabled={startUnavailable || destinationConfirmed || atFinalStep}>{destinationConfirmed ? labels.arrived : atFinalStep ? labels.confirm : labels.next}</button></nav>
      {/* <footer className="navigation-footer"><span>{language === 'tl' ? 'Manu-manong gabay · walang GPS o kamera' : language === 'zh' ? '手动导航 · 无 GPS 或摄像头' : 'Manual navigation · no GPS or camera'}</span></footer> */}
    </main>
  </div>;
}
