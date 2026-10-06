import assert from 'node:assert/strict';
import {
    ELEVATOR_TO_FOURTH_FLOOR_EDGE,
    IndoorNavigationState,
} from '../src/services/indoorNavigationState.js';

const navigation = new IndoorNavigationState({
    startFloor: 1,
    targetFloor: 4,
    destination: 'aricc',
});

const elevator = navigation.updateFromTemporalConfirmation({
    landmark: 'elevator',
    confirmed: true,
});
assert.equal(elevator.instruction, 'Take the elevator to the 4th floor.');
assert.equal(elevator.state.current_floor, 1);
assert.equal(elevator.state.target_floor, 4);
assert.equal(elevator.state.floor_transition_active, true);
assert.equal(elevator.state.last_confirmed_landmark, 'elevator');
assert.equal(elevator.state.next_expected_landmark, 'olcpd_office');

const repeatedElevator = navigation.updateFromTemporalConfirmation({
    landmark: 'elevator',
    confirmed: true,
});
assert.equal(repeatedElevator.instruction, null);

const ambiguousFrame = navigation.updateFromTemporalConfirmation({
    landmark: 'unknown',
    confirmed: true,
});
assert.equal(ambiguousFrame.state.floor_transition_active, true);
assert.equal(ambiguousFrame.state.current_floor, 1);

const arrival = navigation.updateFromTemporalConfirmation({
    landmark: 'olcpd_office',
    confirmed: true,
});
assert.equal(arrival.state.current_floor, 4);
assert.equal(arrival.state.floor_transition_active, false);
assert.equal(arrival.state.current_landmark, 'olcpd_office');
assert.equal(arrival.state.last_confirmed_landmark, 'olcpd_office');
assert.equal(arrival.state.next_expected_landmark, 'window_near_bathroom');
assert.equal(arrival.state.destination, 'aricc');

navigation.recalculateRoute({ destination: 'olcpd_office' });
const repeatedRoute = navigation.updateFromTemporalConfirmation({
    landmark: 'elevator',
    confirmed: true,
});
assert.equal(repeatedRoute.instruction, 'Take the elevator to the 4th floor.');

const customFloors = new IndoorNavigationState({ startFloor: 2, targetFloor: 3 });
const customTransition = customFloors.confirmLandmark('elevator');
assert.equal(customTransition.state.current_floor, 2);
assert.equal(customTransition.state.target_floor, 3);
assert.equal(customTransition.instruction, 'Take the elevator to the 3rd floor.');
assert.deepEqual(customFloors.getFloorTransitionEdge(), {
    from: 'elevator_lower_floor',
    action: 'take_elevator',
    target_floor: 3,
    next_landmark: 'olcpd_office',
    instruction: 'Take the elevator to the 3rd floor.',
});

assert.equal(ELEVATOR_TO_FOURTH_FLOOR_EDGE.action, 'take_elevator');
assert.equal(ELEVATOR_TO_FOURTH_FLOOR_EDGE.target_floor, 4);

console.log('IndoorNavigationState behavior passed');