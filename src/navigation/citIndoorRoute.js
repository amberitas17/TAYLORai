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
];

export const CIT_ROUTE_STEPS = CIT_ROUTE_NODES.map((node, index) => ({
  id: `step-${index + 1}`,
  from: node.id,
  to: CIT_ROUTE_NODES[index + 1]?.id || node.id,
  floor: node.floor,
  instruction: node.instruction,
  landmark: node.landmark,
  transition: node.id === 'elevator-1f',
}));

export const CIT_FLOOR_LABELS = { 1: '1st Floor', 4: '4th Floor' };

export function getNode(nodeId) {
  return CIT_ROUTE_NODES.find((node) => node.id === nodeId) || CIT_ROUTE_NODES[0];
}
