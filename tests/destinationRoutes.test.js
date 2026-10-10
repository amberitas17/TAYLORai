import assert from 'node:assert/strict';
import { CIT_DESTINATION_ROUTES, getDestinationRoute } from '../src/navigation/citIndoorRoute.js';
import { getCITWalkthroughEvidence } from '../src/navigation/citWalkthroughEvidence.js';

const destinations = ['ARICC', 'RIO', 'FABLAB', 'RECON', 'CAESAR'];
assert.deepEqual(Object.keys(CIT_DESTINATION_ROUTES).sort(), [...destinations].sort());
assert.equal(new Set(destinations.map((destination) => getDestinationRoute(destination).id)).size, destinations.length);

for (const destination of destinations) {
    const route = getDestinationRoute(destination);
    assert.equal(route.destination, destination);
    assert.equal(route.start, 'CIT Entrance');
    assert.equal(route.steps[0].from, 'cit-entrance');
    assert.equal(route.steps.length > 0, true);
    assert.deepEqual(route.sourceEvidence.map((evidence) => evidence.nodeId), route.steps.map((step) => step.from));
    assert.equal(route.verifiedStepCount, route.steps.length);
    for (const step of route.steps) {
        const evidence = route.sourceEvidence.find((source) => source.nodeId === step.from);
        assert.deepEqual(
            Object.fromEntries(Object.entries(evidence).filter(([key]) => key !== 'nodeId')),
            getCITWalkthroughEvidence(step.from),
        );
        if (evidence.verificationStatus === 'user-confirmed') {
            assert.equal(evidence.verified, false);
            assert.equal(evidence.sourceVideo, null);
            assert.equal(evidence.photo, null);
        } else {
            assert.equal(evidence.verified, true);
            assert.match(evidence.sourceVideo, /^IMG_\d+\.MOV$/);
            assert.match(evidence.photo, /^\/indoor-evidence\/cit\//);
        }
    }
}

assert.equal(getDestinationRoute('RIO').steps.at(-1).from, 'rio-entrance');
assert.equal(getDestinationRoute('FABLAB').steps.at(-1).from, 'fablab-entrance');
assert.equal(getDestinationRoute('CAESAR').steps.at(-1).from, 'caesar');
assert.equal(getDestinationRoute('ARICC').steps.length, 11);
assert.equal(getDestinationRoute('ARICC').arrivalInstruction, 'Arrive at ARICC.');
assert.equal(getDestinationRoute('RECON').complete, true);
assert.equal(getDestinationRoute('RECON').arrivalInstruction, 'Arrive at RECON.');
assert.equal(getDestinationRoute('RECON').steps.at(-1).from, 'recon');
assert.equal(getDestinationRoute('RECON').steps.at(-1).instruction, 'Arrive at RECON.');
assert.deepEqual(
    getDestinationRoute('RECON').steps.slice(-5).map((step) => step.from),
    ['recon-elevator', 'recon-corridor', 'recon-pot', 'recon-turn', 'recon'],
);

for (const destination of destinations) assert.equal(getDestinationRoute(destination).complete, true);

const rioToFablab = getDestinationRoute('FABLAB').steps;
assert.deepEqual(rioToFablab.slice(-4).map((step) => step.from), ['rio-entrance', 'rio-corridor', 'fablab-corridor', 'fablab-entrance']);
assert.equal(rioToFablab.find((step) => step.from === 'rio-entrance').instruction, 'You have reached RIO. Continue straight along the corridor toward FABLAB.');
assert.equal(rioToFablab.find((step) => step.from === 'rio-corridor').instruction, 'Continue straight toward FABLAB.');
assert.equal(rioToFablab.find((step) => step.from === 'rio-corridor').reference, 'White plant pot');
assert.equal(rioToFablab.find((step) => step.from === 'fablab-corridor').landmark, 'Corridor windows');
assert.equal(rioToFablab.find((step) => step.from === 'fablab-entrance').instruction, 'Continue to the FABLAB entrance.');
assert.equal(getDestinationRoute('CAESAR').steps.some((step) => step.instruction.includes('You have arrived at FABLAB.')), false);

assert.equal(getDestinationRoute('RIO').segments.find((segment) => segment.id === 'aricc-to-rio').status, 'user-confirmed');
assert.equal(getDestinationRoute('FABLAB').segments.find((segment) => segment.id === 'rio-to-fablab').status, 'continuous-video-verified');
assert.equal(getDestinationRoute('CAESAR').segments.find((segment) => segment.id === 'fablab-to-stairs-right-caesar').continuousVideoVerified, false);
assert.equal(getDestinationRoute('RIO').steps.length !== getDestinationRoute('ARICC').steps.length, true);
console.log('Destination route definitions passed');