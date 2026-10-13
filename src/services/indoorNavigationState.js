const DEFAULT_TARGET_FLOOR = 4;
const DEFAULT_NEXT_LANDMARK = 'olcpd_office';
const CIT_BUILDING = 'College of Industrial Technology';
const CIT_BUILDING_CODE = 'CIT';
const CIT_FLOOR = 4;
const CIT_FLOOR_DESTINATIONS = ['RIO', 'FABLAB', 'ARICC', 'RECON', 'CAESAR'];

export const CIT_INDOOR_DESTINATIONS = Object.freeze(
    CIT_FLOOR_DESTINATIONS.reduce((destinations, destination) => ({
        ...destinations,
        [destination.toLowerCase()]: Object.freeze({
            building: CIT_BUILDING,
            buildingCode: CIT_BUILDING_CODE,
            floor: CIT_FLOOR,
            destination,
        }),
    }), {})
);

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

function normalizeIndoorLandmark(landmark) {
    if (typeof landmark !== 'string') return null;
    const normalized = landmark.trim().toUpperCase();
    return CIT_FLOOR_DESTINATIONS.find((destination) => (
        normalized === destination || normalized.includes(destination)
    )) || null;
}

function getIndoorDestination(destination) {
    if (typeof destination !== 'string') return null;
    return CIT_INDOOR_DESTINATIONS[destination.trim().toLowerCase()] || null;
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
            building: CIT_BUILDING,
            building_code: CIT_BUILDING_CODE,
            current_landmark_metadata: null,
            destination_metadata: getIndoorDestination(this.destination),
            route_data_status: 'pending',
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
            return { state: this.getState(), instruction: null };
        }

        if (landmark === 'elevator') {
            return this.enterElevatorTransition();
        }

        const indoorLandmark = normalizeIndoorLandmark(landmark);
        if (indoorLandmark) {
            const metadata = CIT_INDOOR_DESTINATIONS[indoorLandmark.toLowerCase()];
            this.state = {
                ...this.state,
                current_floor: CIT_FLOOR,
                floor_transition_active: false,
                current_landmark: indoorLandmark,
                last_confirmed_landmark: indoorLandmark,
                current_landmark_metadata: metadata,
                next_expected_landmark: null,
                route_data_status: 'pending',
                pending_instruction: null,
            };
            return { state: this.getState(), instruction: null };
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
            current_landmark_metadata: null,
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
        const currentLandmark = this.state.current_landmark;
        this.state = {
            ...this.state,
            destination,
            destination_metadata: getIndoorDestination(destination),
            next_expected_landmark: normalizeIndoorLandmark(currentLandmark)
                ? null
                : this.state.next_expected_landmark,
            route_data_status: normalizeIndoorLandmark(currentLandmark)
                ? 'pending'
                : this.state.route_data_status,
        };
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
            destination_metadata: getIndoorDestination(destination),
            next_expected_landmark: normalizeIndoorLandmark(this.state.current_landmark)
                ? null
                : this.state.next_expected_landmark,
            route_data_status: normalizeIndoorLandmark(this.state.current_landmark)
                ? 'pending'
                : this.state.route_data_status,
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