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
  { id: 'restroom-window', floor: 4, landmark: 'Window near restroom', instruction: 'At the window near the restroom, turn right.', connections: ['hallway-straight'] },
  { id: 'hallway-straight', floor: 4, landmark: 'Hallway', instruction: 'Continue straight along the hallway.', connections: ['ovprei-office'] },
  { id: 'ovprei-office', floor: 4, landmark: 'OVPREI Office', instruction: 'Pass the OVPREI Office.', connections: ['aricc'] },
  { id: 'aricc', floor: 4, landmark: 'ARICC', instruction: 'Arrive at ARICC.', connections: [] },
  { id: 'recon-corridor', floor: 4, landmark: 'RECON corridor', instruction: 'Continue along the corridor toward RECON.', connections: ['recon-turn'] },
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

const VERIFIED_COMMON_STEP_COUNT = 6;

function createRoute({ id, destination, complete, steps, missingSegments = [], arrivalInstruction = null }) {
  return Object.freeze({
    id,
    start: 'CIT Entrance',
    destination,
    complete,
    steps: Object.freeze(steps),
    verifiedStepCount: steps.length,
    sourceEvidence: Object.freeze(steps.map((step) => ({
      nodeId: step.from,
      ...getCITWalkthroughEvidence(step.from),
    }))),
    missingSegments: Object.freeze(missingSegments),
    arrivalInstruction,
  });
}

const verifiedCommonSteps = CIT_ROUTE_STEPS.slice(0, VERIFIED_COMMON_STEP_COUNT);
const reconSteps = [
  ...verifiedCommonSteps,
  {
    id: 'recon-step-1',
    from: 'elevator-4f',
    to: 'recon-corridor',
    floor: 4,
    instruction: 'From the 4th-floor elevator, continue down the corridor toward RECON.',
    landmark: 'RECON corridor',
    transition: false,
  },
  {
    id: 'recon-step-2',
    from: 'recon-corridor',
    to: 'recon-turn',
    floor: 4,
    instruction: 'Continue straight past the corridor landmarks.',
    landmark: 'RECON approach',
    transition: false,
  },
  {
    id: 'recon-step-3',
    from: 'recon-turn',
    to: 'recon',
    floor: 4,
    instruction: 'Follow the two right turns to the RECON entrance.',
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
    arrivalInstruction: 'Arrive at ARICC.',
  }),
  RIO: createRoute({
    id: 'cit-entrance-to-rio',
    destination: 'RIO',
    complete: false,
    steps: verifiedCommonSteps,
    missingSegments: ['4th-floor elevator to RIO entrance'],
  }),
  FABLAB: createRoute({
    id: 'cit-entrance-to-fablab',
    destination: 'FABLAB',
    complete: false,
    steps: verifiedCommonSteps,
    missingSegments: ['4th-floor elevator to FABLAB entrance'],
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
    complete: false,
    steps: verifiedCommonSteps,
    missingSegments: ['4th-floor elevator to CAESAR entrance'],
  }),
});

export function getDestinationRoute(destination) {
  return CIT_DESTINATION_ROUTES[String(destination || '').trim().toUpperCase()] || CIT_DESTINATION_ROUTES.ARICC;
}

export const CIT_FLOOR_LABELS = { 1: '1st Floor', 4: '4th Floor' };

export function getNode(nodeId) {
  return CIT_ROUTE_NODES.find((node) => node.id === nodeId) || CIT_ROUTE_NODES[0];
}
