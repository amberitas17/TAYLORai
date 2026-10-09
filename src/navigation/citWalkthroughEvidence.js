// Evidence records stay explicit until source frames are reviewed.
export const CIT_WALKTHROUGH_EVIDENCE = {
  'cit-entrance': { sourceVideo: 'IMG_4496.MOV', timestamp: '0.00s', photo: '/indoor-evidence/cit/cit-entrance.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: null, next: 'emh-department', turn: 'right' },
  'emh-department': { sourceVideo: 'IMG_4497.MOV', timestamp: '0.00s', photo: '/indoor-evidence/cit/emh-department.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'cit-entrance', next: 'emh-bulletin-board' },
  'emh-bulletin-board': { sourceVideo: 'IMG_4497.MOV', timestamp: '21.02s', photo: '/indoor-evidence/cit/emh-bulletin-to-passage.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'medium', previous: 'emh-department', next: 'small-passage', turn: 'left' },
  'small-passage': { sourceVideo: 'IMG_4498.MOV', timestamp: '0.00s', photo: '/indoor-evidence/cit/small-passage.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'emh-bulletin-board', next: 'elevator-1f', turn: 'right' },
  'elevator-1f': { sourceVideo: 'IMG_4498.MOV', timestamp: '6.00s', photo: '/indoor-evidence/cit/elevator-1f.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'small-passage', next: 'elevator-4f' },
  'elevator-4f': { sourceVideo: 'IMG_4499.MOV', timestamp: '5.00s', photo: '/indoor-evidence/cit/elevator-4f.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'elevator-1f', next: 'olcpd-office' },
  'olcpd-office': { sourceVideo: 'IMG_4525.MOV', timestamp: '0.00s', photo: '/indoor-evidence/cit/olcpd-office.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'elevator-4f', next: 'restroom-window', turn: 'right' },
  'restroom-window': { sourceVideo: 'IMG_4525.MOV', timestamp: '8.01s', photo: '/indoor-evidence/cit/window-near-bathroom.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'olcpd-office', next: 'hallway-straight', turn: 'right' },
  'hallway-straight': { sourceVideo: 'IMG_4525.MOV', timestamp: '13.01s', photo: '/indoor-evidence/cit/ovprei.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'medium', previous: 'restroom-window', next: 'ovprei-office', turn: 'straight' },
  'ovprei-office': { sourceVideo: 'IMG_4638.MOV', timestamp: '10.01s', photo: '/indoor-evidence/cit/ovprei-sign.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'hallway-straight', next: 'aricc' },
  aricc: { sourceVideo: 'IMG_4525.MOV', timestamp: '34.03s', photo: '/indoor-evidence/cit/aricc.jpg', verified: true, verificationStatus: 'reviewed', confidence: 'high', previous: 'ovprei-office', next: null },
};

export function getCITWalkthroughEvidence(nodeId) {
  return CIT_WALKTHROUGH_EVIDENCE[nodeId] || { sourceVideo: null, timestamp: null, photo: null, verified: false, confidence: 'pending' };
}
