import { getCITWalkthroughEvidence } from './citWalkthroughEvidence.js';

export const CIT_FLOOR_PLAN_DIMENSIONS = {
  1: { label: '1st Floor', defaultWidth: 1200, defaultHeight: 800 },
  2: { label: '2nd Floor', defaultWidth: 1200, defaultHeight: 800 },
  3: { label: '3rd Floor', defaultWidth: 1200, defaultHeight: 800 },
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
  { id: 'rio-corridor', floor: 4, landmark: 'Corridor after RIO', instruction: 'Continue straight toward FABLAB.', connections: ['fablab-corridor'] },
  { id: 'fablab-corridor', floor: 4, landmark: 'Corridor windows', instruction: 'Continue straight toward FABLAB.', connections: ['fablab-entrance'] },
  { id: 'fablab-entrance', floor: 4, landmark: 'FABLAB', instruction: 'Continue to the FABLAB entrance.', connections: ['stairs-near-fablab'] },
  { id: 'stairs-near-fablab', floor: 4, landmark: 'Stairs near FABLAB', instruction: 'Proceed toward the stairs near FABLAB.', connections: ['caesar-turn-point'] },
  { id: 'caesar-turn-point', floor: 4, landmark: 'CAESAR turn point', instruction: 'Turn right toward CAESAR.', connections: ['caesar-approach'] },
  { id: 'caesar-approach', floor: 4, landmark: 'CAESAR approach', instruction: 'Continue toward the CAESAR entrance.', connections: ['caesar'] },
  { id: 'caesar', floor: 4, landmark: 'CAESAR', instruction: 'Arrive at CAESAR.', connections: [] },
  // { id: 'recon-elevator', floor: 4, landmark: '4th-floor elevator', instruction: 'At the 4th-floor elevator, turn right and go straight.', connections: ['recon-corridor'] },
  { id: 'recon-corridor', floor: 4, landmark: 'RECON corridor', instruction: 'Continue along the corridor toward RECON.', connections: ['recon-pot'] },
  { id: 'recon-pot', floor: 4, landmark: 'Pot / restroom area', instruction: 'Continue straight past the pot and restroom-side doors.', connections: ['recon-male-restroom'] },
  { id: 'recon-male-restroom', floor: 4, landmark: 'Male\'s restroom', instruction: 'Use the male\'s restroom as your nearest landmark, then turn right.', connections: ['recon'] },
  { id: 'recon', floor: 4, landmark: 'RECON', instruction: 'Arrive at RECON.', connections: [] },
  { id: 'second-floor-stairs', floor: 2, landmark: 'Stairs to 2nd floor', instruction: 'Continue up the stairs to the 2nd floor.', connections: ['deans-office-2f'] },
  { id: 'deans-office-2f', floor: 2, landmark: "Dean's Office", instruction: "Use the Dean's Office as your landmark, then turn left into the U-shaped stairwell.", connections: ['second-floor-u-turn'] },
  { id: 'second-floor-u-turn', floor: 2, landmark: 'U-shaped stair turn', instruction: 'At the Dean\'s Office, turn left through the U-shaped stairwell.', connections: ['third-floor-stairs'] },
  { id: 'third-floor-stairs', floor: 2, landmark: 'Stairs to 3rd floor', instruction: 'Climb the next flight to the 3rd floor.', connections: ['third-floor-right-turn'] },
  { id: 'third-floor-right-turn', floor: 3, landmark: '3rd-floor right turn', instruction: 'On the 3rd floor, turn right.', connections: ['teecs-department'] },
  { id: 'teecs-department', floor: 3, landmark: 'EEC Department', instruction: 'Go straight through the EEC Department corridor.', connections: ['teecs-bulletin-board'] },
  { id: 'teecs-bulletin-board', floor: 3, landmark: 'TEECS Bulletin Board', instruction: 'Continue straight to the TEECS Bulletin Board.', connections: ['teecs-right-turn'] },
  { id: 'teecs-right-turn', floor: 3, landmark: 'TEECS right turn', instruction: 'Near the TEECS Bulletin Board, turn right.', connections: ['caesar-after-right-straight'] },
  { id: 'caesar-after-right-straight', floor: 3, landmark: 'Corridor after right turn', instruction: 'Go straight along the corridor.', connections: ['caesar-last-bench-left'] },
  { id: 'caesar-last-bench-left', floor: 3, landmark: 'Last bench', instruction: 'After the last bench, turn left and go toward the stairs.', connections: ['fourth-floor-stairs'] },
  { id: 'fourth-floor-stairs', floor: 3, landmark: 'Stairs toward 4th floor', instruction: 'Go up to the 4th floor via the stairs.', connections: ['caesar-fourth-floor-left', 'fablab-fourth-floor-straight', 'aricc-stairs-rio-office', 'recon-stairs-window'] },
  { id: 'caesar-fourth-floor-left', floor: 4, landmark: '4th-floor stair landing', instruction: 'After reaching the 4th floor, turn left and go straight.', connections: ['caesar-first-door-right'] },
  { id: 'caesar-first-door-right', floor: 4, landmark: 'First door on the right', instruction: 'The first door on your right is CAESAR.', connections: ['caesar'] },
  { id: 'fablab-fourth-floor-straight', floor: 4, landmark: '4th-floor stair landing', instruction: 'After reaching the 4th floor, go straight along the corridor.', connections: ['fablab-first-door-left', 'rio-fablab-landmark'] },
  { id: 'fablab-first-door-left', floor: 4, landmark: 'First door on the left', instruction: 'The first door on your left is FABLAB.', connections: ['fablab-entrance'] },
  { id: 'aricc-stairs-rio-office', floor: 4, landmark: 'RIO Office', instruction: 'Go straight along the corridor. The nearest landmark is the RIO Office.', connections: ['aricc-stairs-plaque'] },
  { id: 'aricc-stairs-plaque', floor: 4, landmark: 'ARICC plaque', instruction: 'Look for the plaque near ARICC.', connections: ['aricc-stairs-entrance'] },
  { id: 'aricc-stairs-entrance', floor: 4, landmark: 'ARICC entrance', instruction: 'Continue to the ARICC entrance.', connections: ['aricc'] },
  { id: 'rio-fablab-landmark', floor: 4, landmark: 'FABLAB', instruction: 'Use FABLAB as the nearest landmark, then continue straight along the corridor.', connections: ['rio-second-door-right'] },
  { id: 'rio-second-door-right', floor: 4, landmark: 'Second door on the right', instruction: 'The second door on your right is RIO.', connections: ['rio-entrance'] },
  { id: 'recon-stairs-window', floor: 4, landmark: 'Window near restroom', instruction: 'When you reach the window near the restroom, turn left.', connections: ['recon-male-restroom'] },
  { id: 'recon-male-restroom', floor: 4, landmark: "Male's restroom", instruction: "Use the male's restroom as your nearest landmark, then turn right.", connections: ['recon-stairs-right-turn'] },
  { id: 'recon-stairs-right-turn', floor: 4, landmark: 'RECON right turn', instruction: 'Turn right toward RECON.', connections: ['recon'] },
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

export const CIT_THIRD_FLOOR_APPROACH_STEPS = Object.freeze([
  { id: 'second-floor-stairs-step', from: 'second-floor-stairs', to: 'deans-office-2f', floor: 2, instruction: 'Continue up the stairs to the 2nd floor.', landmark: 'Stairs to 2nd floor', transition: true },
  { id: 'deans-office-step', from: 'deans-office-2f', to: 'second-floor-u-turn', floor: 2, instruction: "Use the Dean's Office as your landmark, then turn left into the U-shaped stairwell.", landmark: "Dean's Office", transition: false },
  { id: 'second-floor-u-turn-step', from: 'second-floor-u-turn', to: 'third-floor-stairs', floor: 2, instruction: 'At the Dean\'s Office, turn left through the U-shaped stairwell.', landmark: 'U-shaped stair turn', transition: false },
  { id: 'third-floor-stairs-step', from: 'third-floor-stairs', to: 'third-floor-right-turn', floor: 2, instruction: 'Climb the next flight to the 3rd floor.', landmark: 'Stairs to 3rd floor', transition: true },
  { id: 'third-floor-right-turn-step', from: 'third-floor-right-turn', to: 'teecs-department', floor: 3, instruction: 'On the 3rd floor, turn right.', landmark: '3rd-floor right turn', transition: false },
  { id: 'teecs-department-step', from: 'teecs-department', to: 'teecs-bulletin-board', floor: 3, instruction: 'Go straight through the EEC Department corridor.', landmark: 'EEC Department', transition: false },
  { id: 'teecs-bulletin-board-step', from: 'teecs-bulletin-board', to: 'teecs-right-turn', floor: 3, instruction: 'Continue straight to the TEECS Bulletin Board.', landmark: 'TEECS Bulletin Board', transition: false },
  { id: 'teecs-right-turn-step', from: 'teecs-right-turn', to: 'caesar-after-right-straight', floor: 3, instruction: 'Near the TEECS Bulletin Board, turn right.', landmark: 'TEECS right turn', transition: false },
  { id: 'caesar-after-right-straight-step', from: 'caesar-after-right-straight', to: 'caesar-last-bench-left', floor: 3, instruction: 'Go straight along the corridor.', landmark: 'Corridor after right turn', transition: false },
  { id: 'caesar-last-bench-left-step', from: 'caesar-last-bench-left', to: 'fourth-floor-stairs', floor: 3, instruction: 'After the last bench, turn left and go toward the stairs.', landmark: 'Last bench', transition: false },
  { id: 'fourth-floor-stairs-step', from: 'fourth-floor-stairs', to: 'fourth-floor-stairs', floor: 3, instruction: 'Go up to the 4th floor via the stairs.', landmark: 'Stairs toward 4th floor', transition: true },
]);

export const CIT_CAESAR_STAIRS_STEPS = Object.freeze([
  ...CIT_THIRD_FLOOR_APPROACH_STEPS.slice(0, -1),
  { id: 'fourth-floor-stairs-step', from: 'fourth-floor-stairs', to: 'caesar-fourth-floor-left', floor: 3, instruction: 'Go up to the 4th floor via the stairs.', landmark: 'Stairs toward 4th floor', transition: true },
  { id: 'caesar-fourth-floor-left-step', from: 'caesar-fourth-floor-left', to: 'caesar-first-door-right', floor: 4, instruction: 'After reaching the 4th floor, turn left and go straight.', landmark: '4th-floor stair landing', transition: true },
  { id: 'caesar-first-door-right-step', from: 'caesar-first-door-right', to: 'caesar', floor: 4, instruction: 'The first door on your right is CAESAR.', landmark: 'First door on the right', transition: false },
  { id: 'caesar-stairs-arrival', from: 'caesar', to: 'caesar', floor: 4, instruction: 'Arrive at CAESAR.', landmark: 'CAESAR', transition: false },
]);

export const CIT_FABLAB_STAIRS_STEPS = Object.freeze([
  ...CIT_THIRD_FLOOR_APPROACH_STEPS.slice(0, -1),
  { id: 'fourth-floor-stairs-to-fablab-step', from: 'fourth-floor-stairs', to: 'fablab-fourth-floor-straight', floor: 3, instruction: 'Go up to the 4th floor via the stairs.', landmark: 'Stairs toward 4th floor', transition: true },
  { id: 'fablab-fourth-floor-straight-step', from: 'fablab-fourth-floor-straight', to: 'fablab-first-door-left', floor: 4, instruction: 'After reaching the 4th floor, go straight along the corridor.', landmark: '4th-floor stair landing', transition: true },
  { id: 'fablab-first-door-left-step', from: 'fablab-first-door-left', to: 'fablab-entrance', floor: 4, instruction: 'The first door on your left is FABLAB.', landmark: 'First door on the left', transition: false },
  { id: 'fablab-stairs-arrival', from: 'fablab-entrance', to: 'fablab-entrance', floor: 4, instruction: 'Arrive at FABLAB.', landmark: 'FABLAB', transition: false },
]);

export const CIT_RIO_STAIRS_STEPS = Object.freeze([
  ...CIT_THIRD_FLOOR_APPROACH_STEPS.slice(0, -1),
  { id: 'fourth-floor-stairs-to-rio-step', from: 'fourth-floor-stairs', to: 'fablab-fourth-floor-straight', floor: 3, instruction: 'Go up to the 4th floor via the stairs.', landmark: 'Stairs toward 4th floor', transition: true },
  { id: 'rio-corridor-to-fablab-step', from: 'fablab-fourth-floor-straight', to: 'rio-fablab-landmark', floor: 4, instruction: 'Go straight along the corridor. The nearest landmark is FABLAB.', landmark: '4th-floor corridor', transition: false },
  { id: 'rio-fablab-landmark-step', from: 'rio-fablab-landmark', to: 'rio-second-door-right', floor: 4, instruction: 'From FABLAB, go straight along the corridor.', landmark: 'FABLAB', transition: false },
  { id: 'rio-second-door-right-step', from: 'rio-second-door-right', to: 'rio-entrance', floor: 4, instruction: 'The second door on your right is RIO.', landmark: 'Second door on the right', transition: false },
  { id: 'rio-stairs-arrival', from: 'rio-entrance', to: 'rio-entrance', floor: 4, instruction: 'Arrive at RIO.', landmark: 'RIO', transition: false },
]);

export const CIT_ARICC_STAIRS_STEPS = Object.freeze([
  ...CIT_THIRD_FLOOR_APPROACH_STEPS.slice(0, -1),
  { id: 'fourth-floor-stairs-to-aricc-step', from: 'fourth-floor-stairs', to: 'aricc-stairs-rio-office', floor: 3, instruction: 'Go up to the 4th floor via the stairs.', landmark: 'Stairs toward 4th floor', transition: true },
  { id: 'aricc-stairs-rio-office-step', from: 'aricc-stairs-rio-office', to: 'aricc-stairs-plaque', floor: 4, instruction: 'Go straight along the corridor. The nearest landmark is the RIO Office.', landmark: 'RIO Office', transition: false },
  { id: 'aricc-stairs-plaque-step', from: 'aricc-stairs-plaque', to: 'aricc-stairs-entrance', floor: 4, instruction: 'Look for the plaque near ARICC.', landmark: 'ARICC plaque', transition: false },
  { id: 'aricc-stairs-entrance-step', from: 'aricc-stairs-entrance', to: 'aricc', floor: 4, instruction: 'Continue to the ARICC entrance.', landmark: 'ARICC entrance', transition: false },
  { id: 'aricc-stairs-arrival', from: 'aricc', to: 'aricc', floor: 4, instruction: 'Arrive at ARICC.', landmark: 'ARICC', transition: false },
]);

export const CIT_RECON_STAIRS_STEPS = Object.freeze([
  ...CIT_THIRD_FLOOR_APPROACH_STEPS.slice(0, -1),
  { id: 'fourth-floor-stairs-to-recon-step', from: 'fourth-floor-stairs', to: 'recon-stairs-window', floor: 3, instruction: 'Go up to the 4th floor via the stairs.', landmark: 'Stairs toward 4th floor', transition: true },
  { id: 'recon-stairs-window-step', from: 'recon-stairs-window', to: 'recon-male-restroom', floor: 4, instruction: 'When you reach the window near the restroom, turn left.', landmark: 'Window near restroom', transition: false },
  { id: 'recon-male-restroom-step', from: 'recon-male-restroom', to: 'recon-stairs-right-turn', floor: 4, instruction: "Use the male's restroom as your nearest landmark, then turn right.", landmark: "Male's restroom", transition: false },
  { id: 'recon-stairs-right-turn-step', from: 'recon-stairs-right-turn', to: 'recon', floor: 4, instruction: 'Turn right toward RECON.', landmark: 'RECON right turn', transition: false },
  { id: 'recon-stairs-arrival', from: 'recon', to: 'recon', floor: 4, instruction: 'Arrive at RECON.', landmark: 'RECON', transition: false },
]);

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
  { id: 'rio-arrival-reference', from: 'rio-entrance', to: 'rio-corridor', floor: 4, instruction: 'You have reached RIO. Continue straight along the corridor toward FABLAB.', landmark: 'RIO', transition: false },
];
const rioToFablabSteps = [
  { id: 'rio-corridor-step', from: 'rio-corridor', to: 'fablab-corridor', floor: 4, instruction: 'Continue straight toward FABLAB.', landmark: 'Corridor after RIO', reference: 'White plant pot', transition: false },
  { id: 'corridor-windows-step', from: 'fablab-corridor', to: 'fablab-entrance', floor: 4, instruction: 'Continue straight toward FABLAB.', landmark: 'Corridor windows', transition: false },
  { id: 'fablab-arrival-reference', from: 'fablab-entrance', to: 'fablab-entrance', floor: 4, instruction: 'Continue to the FABLAB entrance.', landmark: 'FABLAB', transition: false },
];
const fablabToCaesarSteps = [
  { id: 'fablab-departure-step', from: 'fablab-entrance', to: 'stairs-near-fablab', floor: 4, instruction: 'From FABLAB, proceed toward the stairs.', landmark: 'FABLAB', transition: false },
  { id: 'stairs-step', from: 'stairs-near-fablab', to: 'caesar-turn-point', floor: 4, instruction: 'At the stairs near FABLAB, turn right toward CAESAR.', landmark: 'Stairs near FABLAB', transition: false },
  { id: 'caesar-right-step', from: 'caesar-turn-point', to: 'caesar-approach', floor: 4, instruction: 'Continue toward CAESAR.', landmark: 'CAESAR turn point', transition: false },
  { id: 'caesar-approach-step', from: 'caesar-approach', to: 'caesar', floor: 4, instruction: 'Continue toward the CAESAR entrance.', landmark: 'CAESAR approach', transition: false },
  { id: 'caesar-entrance-reference', from: 'caesar', to: 'caesar', floor: 4, instruction: 'At the CAESAR entrance.', landmark: 'CAESAR', transition: false },
];
const startToAriccAreaSteps = startToAriccSteps.slice(0, -1).concat(ariccReferenceStep);

export const CIT_ROUTE_SEGMENTS = Object.freeze({
  THIRD_FLOOR_TO_FOURTH_STAIRS: Object.freeze({ id: 'third-floor-to-fourth-floor-stairs', from: '3rd-floor stairs', to: 'Stairs toward 4th floor', status: 'candidate-video-verified', sourceVideos: ['IMG_4946.MOV', 'IMG_4947.MOV'] }),
  START_TO_ARICC: Object.freeze({ id: 'start-to-aricc', from: 'CIT Entrance', to: 'ARICC', status: 'visually-verified' }),
  START_TO_ARICC_AREA: Object.freeze({ id: 'start-to-aricc-area', from: 'CIT Entrance', to: 'ARICC area', status: 'visually-verified' }),
  ARICC_TO_RIO: Object.freeze({ id: 'aricc-to-rio', from: 'ARICC area', to: 'RIO', status: 'user-confirmed', continuousVideoVerified: false }),
  RIO_TO_FABLAB: Object.freeze({ id: 'rio-to-fablab', from: 'RIO', to: 'FABLAB', status: 'continuous-video-verified', sourceVideo: 'IMG_4640.MOV' }),
  FABLAB_TO_CAESAR: Object.freeze({ id: 'fablab-to-stairs-right-caesar', from: 'FABLAB', to: 'CAESAR', status: 'user-confirmed', continuousVideoVerified: false }),
});
const reconSteps = [
  // Share the CIT Entrance → fourth-floor elevator → OLCPD approach with
  // other elevator routes, so a selected 4F starting point is available.
  ...CIT_ROUTE_STEPS.slice(0, 7),
  {
    id: 'recon-step-1',
    from: 'recon-pot',
    to: 'recon-corridor',
    floor: 4,
    instruction: 'Near OLCPD office, continue toward the corridor.',
    landmark: 'Male\'s restroom',
    transition: false,
  },
  {
    id: 'recon-step-2',
    from: 'recon-pot',
    to: 'recon-corridor',
    floor: 4,
    instruction: 'Continue straight. The male\'s restroom will be on your left as the nearest landmark.',
    landmark: 'Male\'s restroom',
    transition: false,
  },
  {
    id: 'recon-step-3',
    from: 'recon-male-restroom',
    to: 'recon',
    floor: 4,
    instruction: 'Turn right toward the RECON entrance.',
    landmark: 'Male\'s restroom',
    transition: false,
  },
  {
    id: 'recon-step-4',
    from: 'recon',
    to: 'recon',
    floor: 4,
    instruction: 'Turn right toward the RECON entrance.',
    landmark: 'Male\'s restroom',
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
  CAESAR_STAIRS: createRoute({
    id: 'cit-stairs-to-caesar',
    destination: 'CAESAR_STAIRS',
    complete: true,
    steps: CIT_CAESAR_STAIRS_STEPS,
    segments: [CIT_ROUTE_SEGMENTS.THIRD_FLOOR_TO_FOURTH_STAIRS],
    arrivalInstruction: 'Arrive at CAESAR.',
  }),
  FABLAB_STAIRS: createRoute({
    id: 'cit-stairs-to-fablab',
    destination: 'FABLAB_STAIRS',
    complete: true,
    steps: CIT_FABLAB_STAIRS_STEPS,
    segments: [CIT_ROUTE_SEGMENTS.THIRD_FLOOR_TO_FOURTH_STAIRS],
    arrivalInstruction: 'Arrive at FABLAB.',
  }),
  RIO_STAIRS: createRoute({
    id: 'cit-stairs-to-rio',
    destination: 'RIO_STAIRS',
    complete: true,
    steps: CIT_RIO_STAIRS_STEPS,
    segments: [CIT_ROUTE_SEGMENTS.THIRD_FLOOR_TO_FOURTH_STAIRS],
    arrivalInstruction: 'Arrive at RIO.',
  }),
  RECON_STAIRS: createRoute({
    id: 'cit-stairs-to-recon',
    destination: 'RECON_STAIRS',
    complete: true,
    steps: CIT_RECON_STAIRS_STEPS,
    segments: [CIT_ROUTE_SEGMENTS.THIRD_FLOOR_TO_FOURTH_STAIRS],
    arrivalInstruction: 'Arrive at RECON.',
  }),
  ARICC_STAIRS: createRoute({
    id: 'cit-stairs-to-aricc',
    destination: 'ARICC_STAIRS',
    complete: true,
    steps: CIT_ARICC_STAIRS_STEPS,
    segments: [CIT_ROUTE_SEGMENTS.THIRD_FLOOR_TO_FOURTH_STAIRS],
    arrivalInstruction: 'Arrive at ARICC.',
  }),
});

export function getDestinationRoute(destination) {
  return CIT_DESTINATION_ROUTES[String(destination || '').trim().toUpperCase()] || CIT_DESTINATION_ROUTES.ARICC;
}

export const CIT_FLOOR_LABELS = { 1: '1st Floor', 2: '2nd Floor', 3: '3rd Floor', 4: '4th Floor' };

export function getNode(nodeId) {
  return CIT_ROUTE_NODES.find((node) => node.id === nodeId) || CIT_ROUTE_NODES[0];
}
