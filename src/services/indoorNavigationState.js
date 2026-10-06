const DEFAULT_TARGET_FLOOR = 4;
const DEFAULT_NEXT_LANDMARK = 'olcpd_office';

export const ELEVATOR_TO_FOURTH_FLOOR_EDGE = Object.freeze({
    from: 'elevator_lower_floor',
    action: 'take_elevator',
    target_floor: DEFAULT_TARGET_FLOOR,
    next_landmark: DEFAULT_NEXT_LANDMARK,
    instruction: 'Take the elevator to the 4th floor.',
});

function validFloor(value) {
    return Number.isInteger(value) ? value : null;
}

function ordinalFloor(floor) {
    const suffix = floor % 100 >= 11 && floor % 100 <= 13
        ? 'th'
        : ({ 1: 'st', 2: 'nd', 3: 'rd' }[floor % 10] || 'th');
    return `${floor}${suffix}`;
}

export class IndoorNavigationState {
    constructor({
        startFloor = null,
        targetFloor = DEFAULT_TARGET_FLOOR,
        destination = null,
        requiresTargetFloor = true,
        nextLandmarkAfterTransition = DEFAULT_NEXT_LANDMARK,
    } = {}) {
        this.startFloor = validFloor(startFloor);
        this.targetFloor = validFloor(targetFloor);
        this.destination = destination;
        this.requiresTargetFloor = requiresTargetFloor;
        this.nextLandmarkAfterTransition = nextLandmarkAfterTransition;
        this.state = this.createInitialState();
        this.announcedInstructions = new Set();
    }

    createInitialState() {
        return {
            current_floor: this.startFloor,
            target_floor: this.targetFloor,
            floor_transition_active: false,
            last_confirmed_landmark: null,
            next_expected_landmark: 'elevator',
            destination: this.destination,
            current_landmark: null,
            pending_instruction: null,
        };
    }

    getState() {
        return { ...this.state };
    }

    getFloorTransitionEdge() {
        if (!this.requiresTargetFloor || this.targetFloor === null) {
            return null;
        }

        return {
            ...ELEVATOR_TO_FOURTH_FLOOR_EDGE,
            target_floor: this.targetFloor,
            next_landmark: this.nextLandmarkAfterTransition,
            instruction: `Take the elevator to the ${ordinalFloor(this.targetFloor)} floor.`,
        };
    }

    updateFromTemporalConfirmation(confirmation) {
        if (!confirmation || confirmation.confirmed !== true) {
            return { state: this.getState(), instruction: null };
        }

        return this.confirmLandmark(confirmation.landmark);
    }

    confirmLandmark(landmark) {
        if (typeof landmark !== 'string' || landmark.length === 0) {
            return { state: this.getState(), instruction: null };
        }

        if (landmark === 'unknown') {
            this.state = {
                ...this.state,
                current_landmark: this.state.floor_transition_active ? null : 'unknown',
            };
            return { state: this.getState(), instruction: null };
        }

        if (landmark === 'elevator') {
            return this.enterElevatorTransition();
        }

        if (
            landmark === this.nextLandmarkAfterTransition &&
            this.state.floor_transition_active
        ) {
            this.state = {
                ...this.state,
                current_floor: this.targetFloor,
                floor_transition_active: false,
                current_landmark: landmark,
                last_confirmed_landmark: landmark,
                next_expected_landmark: this.nextLandmarkAfterTransition === 'olcpd_office'
                    ? 'window_near_bathroom'
                    : null,
                pending_instruction: null,
            };
            return { state: this.getState(), instruction: null };
        }

        if (this.state.floor_transition_active) {
            return {
                state: {
                    ...this.state,
                    current_landmark: landmark === 'unknown' ? null : landmark,
                },
                instruction: null,
            };
        }

        this.state = {
            ...this.state,
            current_landmark: landmark,
            last_confirmed_landmark: landmark,
        };
        return { state: this.getState(), instruction: null };
    }

    enterElevatorTransition() {
        const shouldTransition = this.requiresTargetFloor && this.targetFloor !== null;
        if (!shouldTransition) {
            this.state = {
                ...this.state,
                current_landmark: 'elevator',
                last_confirmed_landmark: 'elevator',
                next_expected_landmark: this.nextLandmarkAfterTransition,
            };
            return { state: this.getState(), instruction: null };
        }

        const instructionKey = `take_elevator:${this.targetFloor}`;
        const instruction = this.announcedInstructions.has(instructionKey)
            ? null
            : `Take the elevator to the ${ordinalFloor(this.targetFloor)} floor.`;
        this.announcedInstructions.add(instructionKey);

        this.state = {
            ...this.state,
            current_landmark: 'elevator',
            last_confirmed_landmark: 'elevator',
            floor_transition_active: true,
            next_expected_landmark: this.nextLandmarkAfterTransition,
            pending_instruction: instruction,
        };
        return { state: this.getState(), instruction };
    }

    setDestination(destination) {
        this.state = { ...this.state, destination };
        this.destination = destination;
        return this.getState();
    }

    recalculateRoute({ destination = this.state.destination, targetFloor = this.targetFloor } = {}) {
        this.destination = destination;
        this.targetFloor = validFloor(targetFloor);
        this.announcedInstructions.clear();
        this.state = {
            ...this.state,
            destination,
            target_floor: this.targetFloor,
            pending_instruction: null,
        };
        return this.getState();
    }

    recoverNavigation() {
        this.announcedInstructions.clear();
        this.state = { ...this.state, pending_instruction: null };
        return this.getState();
    }

    reset() {
        this.announcedInstructions.clear();
        this.state = this.createInitialState();
        return this.getState();
    }
}

export default IndoorNavigationState;