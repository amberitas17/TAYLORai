import LandmarkTemporalConfirmation from './landmarkTemporalConfirmation.js';
import IndoorNavigationState from './indoorNavigationState.js';

export class IndoorNavigationRuntime {
    constructor({
        temporalConfirmation = new LandmarkTemporalConfirmation(),
        navigationState = new IndoorNavigationState(),
    } = {}) {
        this.temporalConfirmation = temporalConfirmation;
        this.navigationState = navigationState;
    }

    processPrediction({ landmark = 'unknown', confidence = 0 } = {}) {
        const confirmation = this.temporalConfirmation.update({ landmark, confidence });
        const navigation = confirmation.confirmed
            ? this.navigationState.updateFromTemporalConfirmation(confirmation)
            : { state: this.navigationState.getState(), instruction: null };

        return { confirmation, navigation };
    }

    reset() {
        this.temporalConfirmation.reset();
        this.navigationState.reset();
        return this.navigationState.getState();
    }
}

export default IndoorNavigationRuntime;