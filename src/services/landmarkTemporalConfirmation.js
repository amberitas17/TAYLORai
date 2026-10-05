const DEFAULT_WINDOW_SIZE = 5;
const DEFAULT_REQUIRED_VOTES = 3;
const DEFAULT_MIN_CONFIDENCE = 0.75;

export class LandmarkTemporalConfirmation {
    constructor({
        windowSize = DEFAULT_WINDOW_SIZE,
        requiredVotes = DEFAULT_REQUIRED_VOTES,
        minConfidence = DEFAULT_MIN_CONFIDENCE,
    } = {}) {
        this.windowSize = windowSize;
        this.requiredVotes = requiredVotes;
        this.minConfidence = minConfidence;
        this.history = [];
        this.confirmedLandmark = 'unknown';
    }

    reset() {
        this.history = [];
        this.confirmedLandmark = 'unknown';
    }

    update({ landmark, confidence }) {
        const prediction = {
            landmark: typeof landmark === 'string' ? landmark : 'unknown',
            confidence: Number.isFinite(confidence) ? confidence : 0,
        };
        this.history.push(prediction);
        this.history = this.history.slice(-this.windowSize);

        const eligible = this.history.filter((item) => item.confidence >= this.minConfidence);
        const votes = new Map();
        for (const item of eligible) {
            votes.set(item.landmark, (votes.get(item.landmark) || 0) + 1);
        }
        const ranked = [...votes.entries()].sort((left, right) => right[1] - left[1]);
        const winner = ranked[0];
        const runnerUpVotes = ranked[1]?.[1] || 0;
        if (winner && winner[1] >= this.requiredVotes && winner[1] > runnerUpVotes) {
            this.confirmedLandmark = winner[0];
        }

        return {
            landmark: this.confirmedLandmark,
            confirmed: Boolean(winner && winner[1] >= this.requiredVotes && winner[1] > runnerUpVotes),
            prediction,
            history: [...this.history],
        };
    }
}

export default LandmarkTemporalConfirmation;