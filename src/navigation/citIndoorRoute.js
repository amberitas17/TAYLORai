import { getCITWalkthroughEvidence } from './citWalkthroughEvidence.js';

export const CIT_FLOOR_PLAN_DIMENSIONS = {
  1: { label: '1st Floor', defaultWidth: 1200, defaultHeight: 800 },
  4: { label: '4th Floor', defaultWidth: 1200, defaultHeight: 800 },
};

// Coordinates are intentionally empty until a real CIT floor plan is imported and calibrated.
export const CIT_ROUTE_NODES = [
  { id: 'cit-entrance', floor: 1, landmark: 'CIT Entrance', instruction: 'At the CIT Entrance, go right toward the EMH Department.', connections: ['emh-department'] },
  { id: 'emh-department', floor: 1, landmark: 'EMH Department', instruction: 'Continue to the EMH Department.', connections: ['emh-bulletin-board'] },
  { id: 'emh-bulletin-board', floor: 1, landmark: 'EMH Bulletin Board', instruction: 'At the EMH Bulletin Board, turn left.', connections: ['small-passage'] },
  { id: 'small-passage', floor: 1, landmark: 'Small passage', instruction: 'Enter the small passage and turn right.', connections: ['elevator-1f'] },
  { id: 'elevator-1f', floor: 1, landmark: 'Elevator', instruction: 'Continue to the elevator on the 1st floor.', connections: ['elevator-4f'] },
  { id: 'elevator-4f', floor: 4, landmark: 'Elevator', instruction: 'Take the elevator to the 4th floor, then follow the angled approach toward OLCPD.', connections: ['olcpd-office'] },
  { id: 'olcpd-office', floor: 4, landmark: 'OLCPD', instruction: 'At OLCPD, turn right.', connections: ['restroom-window'] },
  { id: 'restroom-window', floor: 4, landmark: 'Window near restroom', instruction: 'At the window near the restroom, turn left.', connections: ['hallway-straight'] },
  { id: 'hallway-straight', floor: 4, landmark: 'Hallway', instruction: 'Continue straight along the hallway.', connections: ['ovprei-office'] },
  { id: 'ovprei-office', floor: 4, landmark: 'OVPREI Office', instruction: 'Pass the OVPREI Office.', connections: ['aricc'] },
  { id: 'aricc', floor: 4, landmark: 'ARICC', instruction: 'Arrive at ARICC.', connections: [] },
  { id: 'aricc-rio-connector', floor: 4, landmark: 'ARICC area toward RIO', instruction: 'Use ARICC as the nearest reference landmark, then continue toward RIO.', connections: ['rio-entrance'] },
  { id: 'rio-entrance', floor: 4, landmark: 'RIO', instruction: 'Continue to the RIO entrance.', connections: ['rio-corridor'] },
  { id: 'rio-corridor', floor: 4, landmark: 'Corridor after RIO', instruction: 'Continue along the corridor toward FABLAB.', connections: ['fablab-entrance'] },
  { id: 'fablab-entrance', floor: 4, landmark: 'FABLAB', instruction: 'Continue to the FABLAB entrance.', connections: ['fablab-corridor'] },
  { id: 'fablab-corridor', floor: 4, landmark: 'FABLAB departure corridor', instruction: 'From FABLAB, continue toward the stairs.', connections: ['stairs-near-fablab'] },
  { id: 'stairs-near-fablab', floor: 4, landmark: 'Stairs near FABLAB', instruction: 'Proceed toward the stairs near FABLAB.', connections: ['caesar-turn-point'] },
  { id: 'caesar-turn-point', floor: 4, landmark: 'CAESAR turn point', instruction: 'Turn right toward CAESAR.', connections: ['caesar-approach'] },
  { id: 'caesar-approach', floor: 4, landmark: 'CAESAR approach', instruction: 'Continue toward the CAESAR entrance.', connections: ['caesar'] },
  { id: 'caesar', floor: 4, landmark: 'CAESAR', instruction: 'Arrive at CAESAR.', connections: [] },
  { id: 'recon-elevator', floor: 4, landmark: '4th-floor elevator', instruction: 'At the 4th-floor elevator, turn right and go straight.', connections: ['recon-corridor'] },
  { id: 'recon-corridor', floor: 4, landmark: 'RECON corridor', instruction: 'Continue along the corridor toward RECON.', connections: ['recon-pot'] },
  { id: 'recon-pot', floor: 4, landmark: 'Pot / restroom area', instruction: 'Continue straight past the pot and restroom-side doors.', connections: ['recon-turn'] },
  { id: 'recon-turn', floor: 4, landmark: 'RECON approach', instruction: 'Follow the corridor through the two right turns.', connections: ['recon'] },
  { id: 'recon', floor: 4, landmark: 'RECON', instruction: 'Arrive at RECON.', connections: [] },
];

export const CIT_ROUTE_STEPS = CIT_ROUTE_NODES.slice(0, 11).map((node, index) => ({
  id: `step-${index + 1}`,
  from: node.id,
  to: CIT_ROUTE_NODES[index + 1]?.id || node.id,
  floor: node.floor,
  instruction: node.instruction,
  landmark: node.landmark,
  transition: node.id === 'elevator-1f',
}));

function createRoute({ id, destination, complete, steps, segments = [], missingSegments = [], arrivalInstruction = null }) {
  return Object.freeze({
    id,
    start: 'CIT Entrance',
    destination,
    complete,
    steps: Object.freeze(steps),
    verifiedStepCount: steps.length,
    segments: Object.freeze(segments),
    sourceEvidence: Object.freeze(steps.map((step) => ({
      nodeId: step.from,
      ...getCITWalkthroughEvidence(step.from),
    }))),
    missingSegments: Object.freeze(missingSegments),
    arrivalInstruction,
  });
}

const startToAriccSteps = CIT_ROUTE_STEPS;
const ariccReferenceStep = {
  id: 'aricc-reference-for-rio',
  from: 'aricc',
  to: 'aricc-rio-connector',
  floor: 4,
  instruction: 'Use ARICC as the nearest reference landmark, then continue toward RIO.',
  landmark: 'ARICC area',
  transition: false,
};
const ariccToRioSteps = [
  ariccReferenceStep,
  { id: 'aricc-rio-connector-step', from: 'aricc-rio-connector', to: 'rio-corridor', floor: 4, instruction: 'Continue from the ARICC area toward the RIO entrance.', landmark: 'ARICC area toward RIO', transition: false },
  { id: 'rio-arrival-reference', from: 'rio-corridor', to: 'rio-entrance', floor: 4, instruction: 'You have arrived at the RIO entrance.', landmark: 'RIO', transition: false },
];
const rioToFablabSteps = [
  { id: 'rio-corridor-step', from: 'rio-corridor', to: 'fablab-entrance', floor: 4, instruction: 'Continue along the corridor toward FABLAB.', landmark: 'Corridor after RIO', transition: false },
  { id: 'fablab-arrival-reference', from: 'fablab-entrance', to: 'fablab-corridor', floor: 4, instruction: 'Continue to the FABLAB entrance.', landmark: 'FABLAB', transition: false },
];
const fablabToCaesarSteps = [
  { id: 'fablab-departure-step', from: 'fablab-corridor', to: 'stairs-near-fablab', floor: 4, instruction: 'From FABLAB, proceed toward the stairs.', landmark: 'FABLAB departure corridor', transition: false },
  { id: 'stairs-step', from: 'stairs-near-fablab', to: 'caesar-turn-point', floor: 4, instruction: 'At the stairs near FABLAB, turn right toward CAESAR.', landmark: 'Stairs near FABLAB', transition: false },
  { id: 'caesar-right-step', from: 'caesar-turn-point', to: 'caesar-approach', floor: 4, instruction: 'Continue toward CAESAR.', landmark: 'CAESAR turn point', transition: false },
  { id: 'caesar-approach-step', from: 'caesar-approach', to: 'caesar', floor: 4, instruction: 'Continue toward the CAESAR entrance.', landmark: 'CAESAR approach', transition: false },
  { id: 'caesar-entrance-reference', from: 'caesar', to: 'caesar', floor: 4, instruction: 'At the CAESAR entrance.', landmark: 'CAESAR', transition: false },
];
const startToAriccAreaSteps = startToAriccSteps.slice(0, -1).concat(ariccReferenceStep);

export const CIT_ROUTE_SEGMENTS = Object.freeze({
  START_TO_ARICC: Object.freeze({ id: 'start-to-aricc', from: 'CIT Entrance', to: 'ARICC', status: 'visually-verified' }),
  START_TO_ARICC_AREA: Object.freeze({ id: 'start-to-aricc-area', from: 'CIT Entrance', to: 'ARICC area', status: 'visually-verified' }),
  ARICC_TO_RIO: Object.freeze({ id: 'aricc-to-rio', from: 'ARICC area', to: 'RIO', status: 'user-confirmed', continuousVideoVerified: false }),
  RIO_TO_FABLAB: Object.freeze({ id: 'rio-to-fablab', from: 'RIO', to: 'FABLAB', status: 'continuous-video-verified', sourceVideo: 'IMG_4640.MOV' }),
  FABLAB_TO_CAESAR: Object.freeze({ id: 'fablab-to-stairs-right-caesar', from: 'FABLAB', to: 'CAESAR', status: 'user-confirmed', continuousVideoVerified: false }),
});
const reconSteps = [
  ...CIT_ROUTE_STEPS.slice(0, 5),
  {
    id: 'recon-step-1',
    from: 'recon-elevator',
    to: 'recon-corridor',
    floor: 4,
    instruction: 'At the 4th-floor elevator, turn right and go straight.',
    landmark: '4th-floor elevator',
    transition: false,
  },
  {
    id: 'recon-step-2',
    from: 'recon-corridor',
    to: 'recon-pot',
    floor: 4,
    instruction: 'Continue straight past the pot and restroom-side doors.',
    landmark: 'Pot / restroom area',
    transition: false,
  },
  {
    id: 'recon-step-3',
    from: 'recon-pot',
    to: 'recon-turn',
    floor: 4,
    instruction: 'Continue straight, then turn right at the corridor corner.',
    landmark: 'RECON approach',
    transition: false,
  },
  {
    id: 'recon-step-4',
    from: 'recon-turn',
    to: 'recon',
    floor: 4,
    instruction: 'Turn right toward the RECON entrance.',
    landmark: 'RECON approach',
    transition: false,
  },
  {
    id: 'recon-arrival',
    from: 'recon',
    to: 'recon',
    floor: 4,
    instruction: 'Arrive at RECON.',
    landmark: 'RECON',
    transition: false,
  },
];

export const CIT_DESTINATION_ROUTES = Object.freeze({
  ARICC: createRoute({
    id: 'cit-entrance-to-aricc',
    destination: 'ARICC',
    complete: true,
    steps: CIT_ROUTE_STEPS,
    segments: [CIT_ROUTE_SEGMENTS.START_TO_ARICC],
    arrivalInstruction: 'Arrive at ARICC.',
  }),
  RIO: createRoute({
    id: 'cit-entrance-to-rio',
    destination: 'RIO',
    complete: true,
    steps: startToAriccAreaSteps.concat(ariccToRioSteps.slice(1)),
    segments: [CIT_ROUTE_SEGMENTS.START_TO_ARICC_AREA, CIT_ROUTE_SEGMENTS.ARICC_TO_RIO],
    // missingSegments: ['ARICC area to RIO entrance: no continuous recording shows the handoff'],
    arrivalInstruction: 'Arrive at RIO.',
  }),
  FABLAB: createRoute({
    id: 'cit-entrance-to-fablab',
    destination: 'FABLAB',
    complete: true,
    steps: startToAriccAreaSteps.concat(ariccToRioSteps.slice(1), rioToFablabSteps),
    segments: [CIT_ROUTE_SEGMENTS.START_TO_ARICC_AREA, CIT_ROUTE_SEGMENTS.ARICC_TO_RIO, CIT_ROUTE_SEGMENTS.RIO_TO_FABLAB],
    // missingSegments: ['ARICC area to RIO entrance: no continuous recording shows the handoff'],
    arrivalInstruction: 'Arrive at FABLAB.',
  }),
  RECON: createRoute({
    id: 'cit-entrance-to-recon',
    destination: 'RECON',
    complete: true,
    steps: reconSteps,
    arrivalInstruction: 'Arrive at RECON.',
  }),
  CAESAR: createRoute({
    id: 'cit-entrance-to-caesar',
    destination: 'CAESAR',
    complete: true,
    steps: startToAriccAreaSteps.concat(ariccToRioSteps.slice(1), rioToFablabSteps, fablabToCaesarSteps),
    segments: [CIT_ROUTE_SEGMENTS.START_TO_ARICC_AREA, CIT_ROUTE_SEGMENTS.ARICC_TO_RIO, CIT_ROUTE_SEGMENTS.RIO_TO_FABLAB, CIT_ROUTE_SEGMENTS.FABLAB_TO_CAESAR],
    // missingSegments: ['ARICC area to RIO entrance: no continuous recording shows the handoff', 'FABLAB to stairs to right turn to CAESAR: candidate footage is split across recordings'],
    arrivalInstruction: 'Arrive at CAESAR.',
  }),
});

export function getDestinationRoute(destination) {
  return CIT_DESTINATION_ROUTES[String(destination || '').trim().toUpperCase()] || CIT_DESTINATION_ROUTES.ARICC;
}

export const CIT_FLOOR_LABELS = { 1: '1st Floor', 4: '4th Floor' };

export function getNode(nodeId) {
  return CIT_ROUTE_NODES.find((node) => node.id === nodeId) || CIT_ROUTE_NODES[0];
}
