import assert from 'node:assert/strict';
import IndoorNavigationRuntime from '../src/services/indoorNavigationRuntime.js';
import IndoorNavigationState from '../src/services/indoorNavigationState.js';

const spokenInstructions = [];
const runtime = new IndoorNavigationRuntime({
    navigationState: new IndoorNavigationState({
        startFloor: 1,
        targetFloor: 4,
        destination: 'aricc',
    }),
});

function process(landmark, confidence = 0.95) {
    const result = runtime.processPrediction({ landmark, confidence });
    if (result.navigation.instruction) {
        spokenInstructions.push(result.navigation.instruction);
    }
    return result;
}

process('emh_department');
process('emh_department');
const emh = process('emh_department');
assert.equal(emh.confirmation.landmark, 'emh_department');
assert.equal(emh.confirmation.confirmed, true);

process('elevator');
process('unknown', 0.6);
process('elevator');
const elevator = process('elevator');
assert.equal(elevator.confirmation.landmark, 'elevator');
assert.equal(elevator.confirmation.confirmed, true);
assert.equal(elevator.navigation.state.floor_transition_active, true);
assert.equal(spokenInstructions.length, 1);
assert.equal(spokenInstructions[0], 'Take the elevator to the 4th floor.');

const noisyElevator = process('unknown', 0.95);
assert.equal(noisyElevator.navigation.state.floor_transition_active, true);
assert.equal(noisyElevator.navigation.state.current_floor, 1);
process('unknown', 0.95);
process('elevator');
assert.equal(spokenInstructions.length, 1);

process('olcpd_office');
process('unknown', 0.4);
process('olcpd_office');
const olcpd = process('olcpd_office');
assert.equal(olcpd.navigation.state.floor_transition_active, false);
assert.equal(olcpd.navigation.state.current_floor, 4);
assert.equal(olcpd.navigation.state.current_landmark, 'olcpd_office');
assert.equal(olcpd.navigation.state.destination, 'aricc');
assert.notEqual(olcpd.navigation.state.current_landmark, 'aricc');

const finalConfirmation = process('olcpd_office');
assert.equal(finalConfirmation.navigation.state.next_expected_landmark, 'window_near_bathroom');
assert.equal(spokenInstructions.length, 1);

console.log('IndoorNavigationRuntime integration behavior passed');