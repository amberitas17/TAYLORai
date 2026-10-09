import assert from 'node:assert/strict';
import { CIT_DESTINATION_ROUTES, getDestinationRoute } from '../src/navigation/citIndoorRoute.js';
import { getCITWalkthroughEvidence } from '../src/navigation/citWalkthroughEvidence.js';

const destinations = ['ARICC', 'RIO', 'FABLAB', 'RECON', 'CAESAR'];
const incompleteDestinations = destinations.filter((destination) => destination !== 'ARICC');

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
        assert.equal(evidence.verified, true);
        assert.match(evidence.sourceVideo, /^IMG_\d+\.MOV$/);
        assert.match(evidence.photo, /^\/indoor-evidence\/cit\//);
    }
}

assert.equal(getDestinationRoute('RIO').steps.length, 6);
assert.equal(getDestinationRoute('ARICC').steps.length, 11);
assert.equal(getDestinationRoute('ARICC').arrivalInstruction, 'Arrive at ARICC.');
assert.equal(getDestinationRoute('RECON').complete, true);
assert.equal(getDestinationRoute('RECON').arrivalInstruction, 'Arrive at RECON.');
assert.equal(getDestinationRoute('RECON').steps.at(-1).to, 'recon');

for (const destination of incompleteDestinations.filter((destination) => destination !== 'RECON')) {
    const route = getDestinationRoute(destination);
    assert.equal(route.complete, false);
    assert.equal(route.arrivalInstruction, null);
    assert.equal(route.steps.at(-1).from, 'elevator-4f');
    assert.equal(route.missingSegments.length > 0, true);
    assert.equal(route.steps.some((step) => step.from === destination.toLowerCase()), false);
    assert.equal(route.steps.some((step) => step.instruction.includes('Arrive at')), false);
}

assert.equal(getDestinationRoute('RIO').steps[0].instruction, getDestinationRoute('FABLAB').steps[0].instruction);
assert.equal(getDestinationRoute('RIO').steps.length !== getDestinationRoute('ARICC').steps.length, true);
console.log('Destination route definitions passed');