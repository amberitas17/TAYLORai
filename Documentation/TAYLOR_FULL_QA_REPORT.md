# TAYLOR AI Full QA Report

**Audit date:** 2026-10-10  
**Production target:** https://taylorai.vercel.app/  
**Scope:** Production route audit, source review, browser automation, offline/navigation checks, model metadata verification, and static quality checks.  
**Production changes made:** None. Models, labels, routes, and deployment were not changed.

## Executive Summary

The deployed application is reachable and most requested routes render. The TAYLOR assistant returns a coherent local knowledge answer, `/ai-navigation` is lightweight and works after caching, and the machine-vision pages load camera/model UI without failed network requests in the automated browser.

The production release is **not production-ready** for the requested acceptance criteria:

1. **High:** Production RECON metadata contains `fluke_941_temperature_humidity_meter` and does not contain `fluke_971_temperature_humidity_meter`. The current workspace metadata has the opposite intended definition. This is a deployed model/version mismatch and directly violates the Fluke 941 removal requirement.
2. **High:** Production FABLAB navigation route text is stale. The deployed RIO step says `You have arrived at the RIO entrance.` and the next card says `Continue along the corridor toward FABLAB.` The current source requires the exact RIO continuation announcement and `Continue straight toward FABLAB.`
3. **Medium:** The deployed exhibit pages show `EXHIBIT DETECTED / UNKNOWN` during a no-camera-input run. This was not a valid accuracy sample, but the UI wording is misleading and should say no usable frame or unknown object rather than exhibit detected.
4. **Medium:** Speech synthesis repeatedly logged `[TTS] speech error {error: interrupted, message: speech synthesis failed}` while route steps were changed quickly. This may be expected cancellation behavior, but it is noisy and was not proven to be user-transparent.
5. **Medium:** `npm run lint` fails with 451 errors and 22 warnings. Several errors are in active application paths, including `src/ai-exhibit.jsx`, `src/components/AINavigation.jsx`, and `src/services/speechAPI.js`.

Camera permission, real camera inference, WebGL/ONNX inference FPS, memory growth, Android Chrome, iPhone Safari, and installed-PWA behavior were **not** certified because the available browser session did not provide a real camera or physical devices. Emulation must not be treated as real-device confirmation.

## Test Environment and Method

- Production testing used integrated Playwright browser automation against the production URL.
- Desktop viewport: 1280 x 900 where applicable.
- Mobile layout simulation: 390 x 844 CSS viewport only; this is not Android or iPhone hardware testing.
- Local validation: `node --test tests/destinationRoutes.test.js`, `npm run build`, `npm run lint`.
- Browser console, failed requests, page text, route transitions, resource URLs, service-worker behavior, and Cache Storage behavior were inspected.
- No production model, route, or cache was deleted or replaced.
- No real camera permission was available to the automated browser. No physical Android/iPhone/PWA device was available.

## Route-by-Route Results

### 1. `/machine-vision`

**Status: BLOCKED for full acceptance; PASS for independent UI/model initialization checks.**

Observed:

- Page rendered `AI Vision — Live Emotion & Age`, a video element, two canvases, and face-analysis status.
- FaceAPI resources were requested: tiny face detector, face expressions, and age/gender model manifests/shards.
- After initialization the page displayed `Face analysis ready` and `Waiting for visitor...` / `No detection yet`.
- No failed network requests were observed during the route pass.
- Source review confirms avatar initialization and FaceAPI initialization are separate asynchronous flows in `src/components/AIVision.jsx`; FaceAPI is scheduled through idle work and is not the avatar’s initialization dependency.
- A production Canvas2D warning was observed about `getImageData` and `willReadFrequently`.

Not executed:

- Camera permission grant, real face frame, age estimate, emotion estimate, inference FPS, tab-switch recovery, and camera teardown on a physical browser.
- Slow 4G/3G camera behavior and repeated camera initialization under real hardware.

### 2. `/taylor`

**Status: PASS for tested local assistant path; BLOCKED for full network failure matrix.**

Observed:

- TAYLOR rendered with ready state, avatar/guide status, quick-action buttons, chat textbox, and Send button.
- Clicking `What is BulSU?` produced a coherent response describing BulSU, ARICC, CBS, FABLAB, and FIC.
- The interaction completed without failed requests or console errors.
- No unnecessary model resources appeared in the route resource sample.

Not executed:

- Duplicate-send race, API timeout, failed API recovery, slow-connection retry, and online AI API failure behavior.
- The tested quick action appears local/cached; this does not certify any remote AI API path.

### 3. `/machine-vision-aricc`

**Status: BLOCKED for classification accuracy; PASS for page/model asset loading.**

Observed:

- Page rendered continuous exhibit detection and an upload-test-video control.
- Browser requested the exhibit gate ONNX model, ORT WASM, gate metadata/index, face detector resources, and ARICC classifier/metadata.
- No failed requests were observed in the route pass.

Not executed:

- ARICC camera permission, known-exhibit accuracy, unknown/background rejection, temporal stability, mobile inference, or cache-hit inference.

### 4. `/machine-vision-recon`

**Status: FAIL for deployed model contract; BLOCKED for live accuracy.**

Observed production metadata:

- `model_name`: `recon_unified_v1`.
- 13 output classes.
- Contains `fluke_941_temperature_humidity_meter`.
- Does not contain `fluke_971_temperature_humidity_meter`.

The current workspace metadata at `public/models/recon/recon_classifier_metadata.json` contains `fluke_971_temperature_humidity_meter` and no Fluke 941. Production also requested the older-looking asset version `v=20261004-recon-unified-v1`, while current source uses `20261010-recon-13class-v1`. This is confirmed deployment drift, not an inference-quality assumption.

The page itself rendered RECON capture/correction UI and loaded the deployed model resources without a request failure. No camera frame was available, so Fluke 971/941 visual classification accuracy was not executed.

### 5. `/machine-vision-fablab`

**Status: BLOCKED for accuracy; FAIL for no-input status wording.**

Observed:

- FABLAB classifier and metadata loaded successfully.
- During the no-camera-input run the page displayed `Analyzing image...` followed by `EXHIBIT DETECTED` and `UNKNOWN`.
- No actual exhibit image was supplied, so this cannot establish a false-positive model classification. It does establish that the user-facing state can describe an unknown/no-input frame as an exhibit detection.

### 6. `/machine-vision-caesar`

**Status: BLOCKED for accuracy; PASS for page/model asset loading.**

Observed:

- CAESAR classifier and metadata loaded successfully.
- Page rendered the camera/upload surface without failed network requests.
- No real frame was available; accuracy, rejection, temporal stability, mobile inference, and offline model reuse were not tested.

### 7. `/ai-navigation`

**Status: FAIL against deployed route-content acceptance; PASS for basic manual/offline shell behavior.**

Observed:

- Starting point and destination controls rendered.
- Manual navigation controls rendered: Previous, Confirm landmark, and Next.
- The UI explicitly states `Manual navigation · no GPS or camera`; no automatic indoor-position claim was observed.
- Selecting FABLAB produced a 15-step route. The route starts at CIT Entrance and includes ARICC/RIO/FABLAB progression.
- Rapid Next/Previous interaction kept the page responsive, but generated repeated TTS interruption errors and aborted old image requests as cards changed.
- Production step capture showed:
  - Step 13: `RIO` with `You have arrived at the RIO entrance.`
  - Step 14: `Corridor after RIO` with `Continue along the corridor toward FABLAB.`
  - Step 15: FABLAB card with `Continue to the FABLAB entrance.` and a disabled `Arrived` control.
- The deployed route therefore does not contain the current required exact wording and is stale relative to the source.
- At a 390 x 844 viewport, `scrollWidth` was 375 and there was no horizontal overflow.
- After a successful load, setting the browser offline and reloading preserved the navigation shell and route controls, demonstrating cached-shell behavior.

Not executed:

- Real Android Chrome, iPhone Safari, installed Android PWA, installed iPhone PWA, orientation changes, and hardware speech behavior.
- No landmark recognition was invoked or reintroduced. Existing landmark-related modules in the repository were not used for navigation testing.

## Model and Label Audit

| Zone | Production asset observed | Metadata/page result | Status |
|---|---|---|---|
| ARICC | `/models/aricc/aricc_classifier.onnx` and metadata | Loaded; no frame accuracy sample | BLOCKED |
| RECON | `/models/recon/recon_classifier.onnx` and metadata | Deployed metadata has Fluke 941 and lacks Fluke 971 | FAIL |
| FABLAB | `/models/fablab/fablab_classifier.onnx` and metadata | Loaded; no-input UI reported `EXHIBIT DETECTED UNKNOWN` | BLOCKED/FAIL wording |
| CAESAR | `/models/caesar/caesar_classifier.onnx` and metadata | Loaded; no frame accuracy sample | BLOCKED |

The current source service defines a shared recognition threshold of 0.80 and margin of 0.15 in `src/services/exhibitDetectionService.js`; live production behavior was not measurable without a camera frame. The source also includes face-detector gating intended to reject people/backgrounds, but this was not certified against real samples.

## Performance Measurements

Measured in the production browser session:

| Measurement | Result | Notes |
|---|---:|---|
| `/machine-vision` route pass | ~1.26 s | Existing browser/session cache; not a cold-device benchmark |
| `/taylor` route pass | ~1.53 s | Existing browser/session cache |
| Exhibit route pass after wait | ~5.06 s | Includes a 5 s observation window; not a precise model-init metric |
| `/ai-navigation` route pass | ~1.27 s | Existing browser/session cache |
| RECON metadata response | 950 bytes | HTTP 200 production response |
| RECON ONNX response | 5,528,696 bytes | HTTP 200 production response |
| Local ORT WASM build artifact | 11,241.64 KiB | From successful local Vite build output |
| Mobile layout width | 375 CSS px content at 390 px viewport | No horizontal overflow observed |
| Face inference FPS | Not measured | No camera frame available |
| ONNX first/average inference latency | Not measured | No camera frame available |
| JS heap/memory growth | Not measured | Browser tooling did not expose reliable production heap measurement |

The timings above are route-observation timings, not Core Web Vitals or cold-cache performance. A proper performance run should use a fresh browser profile, throttled network, device hardware, and repeated samples.

## Network, Offline, and Cache Results

- Stable production navigation and model requests completed without observed failed requests during the initial route pass.
- Offline reload of `/ai-navigation` after successful online load retained the page, route controls, and cached evidence shell.
- Source `public/sw.js` uses runtime caching for app requests and a separate model cache, but it does not precache model assets. First-visit offline behavior therefore cannot provide models that have never been downloaded.
- Source face models and avatar assets implement their own Cache Storage/retry logic. This is favorable for progressive initialization, but cold first-visit offline behavior remains unavailable by design.
- First visit while offline was not executed in a fresh browser profile. It should be tested explicitly to verify that the UI gives a clear unavailable-assets state rather than an indefinite loading state.
- Slow 4G/3G, request interruption/resume, and bounded retry behavior were not measured with controlled network throttling in this audit.

## Error and Regression Findings

### High: Production RECON model is the wrong class definition

**Evidence:** Production metadata has Fluke 941 and lacks Fluke 971; current workspace metadata has Fluke 971 and no Fluke 941. Production resource URLs use the older `20261004` version while source uses `20261010-recon-13class-v1`.

**Impact:** A user can receive the wrong class identity for the Fluke instruments, and the requested Fluke 941 removal is not live.

**Recommended fix:** Deploy the already-reviewed intended model and metadata together, then verify the production metadata class list and ONNX/metadata version pair before release. Do not retrain as part of this QA finding.

### High: Production navigation text is stale

**Evidence:** Deployed FABLAB route step 13 says `You have arrived at the RIO entrance.` and step 14 says `Continue along the corridor toward FABLAB.`; current source/tests require the exact intermediate RIO continuation and straight instruction.

**Impact:** RIO can be presented as an arrival and voice/card semantics do not match the requested route contract.

**Recommended fix:** Deploy the current navigation source, then repeat the exact step capture and confirm FABLAB arrival only after explicit FABLAB confirmation.

### Medium: No-input exhibit status says `EXHIBIT DETECTED UNKNOWN`

**Impact:** Users may interpret an absent/invalid frame as a positive exhibit detection.

**Recommended fix:** Separate `NO_FRAME`, `UNKNOWN_OBJECT`, and `EXHIBIT_CONFIRMED` states in the UI. Only the last should use `EXHIBIT DETECTED`.

### Medium: Speech cancellation errors are noisy during route changes

**Evidence:** Repeated `[TTS] speech error {error: interrupted, message: speech synthesis failed}` messages occurred while navigating steps quickly.

**Impact:** Rapid navigation may produce stale/cancelled speech and pollutes diagnostics. The card remained responsive, but voice correctness was not certifiable in this browser.

**Recommended fix:** Treat intentional speech cancellation as a non-error, cancel the previous utterance before starting the next, and add a focused test that card instruction and spoken instruction always use the same current step.

### Medium: Static quality gate is red

`npm run lint` completed with **451 errors and 22 warnings**. Relevant examples include unused/undefined symbols and hook warnings in `src/ai-exhibit.jsx`, an unused `nextStep` in `src/components/AINavigation.jsx`, and unused/empty catch variables in `src/services/speechAPI.js`. This is a repository-wide baseline issue, but active route files are included and should be triaged before a release gate is introduced.

## Navigation Relationship Review

- ARICC is represented as the nearest reference landmark for the RIO connector in the current route source.
- RIO is the intermediate route reference before FABLAB.
- FABLAB proceeds to stairs, then a right turn toward CAESAR in the current route source.
- The UI states that navigation is manual and does not claim GPS/camera position detection.
- The deployed route content is stale, so these relationships require production re-verification after deployment.
- No landmark recognition was tested or added.

## Required Test Status Matrix

| Requirement | Status | Evidence or blocker |
|---|---|---|
| Production route order | PASS | All seven requested paths visited in order |
| Avatar initializes independently | PASS source / BLOCKED hardware | Source separation observed; real avatar timing not measured on device |
| Camera permission and preview | BLOCKED | No camera permission/device available |
| FaceAPI model initialization | PASS partial | Resources loaded and face-analysis-ready state rendered |
| Age/emotion inference | BLOCKED | No real face frame |
| TAYLOR chat response | PASS | BulSU quick action returned coherent answer |
| Chat timeout/failure recovery | NOT TESTED | No controlled API/network failure run |
| ARICC model loading | PASS | ONNX/metadata resources returned |
| ARICC classification accuracy | BLOCKED | No camera/sample fixture |
| RECON Fluke 971/941 separation | FAIL | Production metadata is reversed from intended source |
| FABLAB classification accuracy | BLOCKED | No valid input frame |
| CAESAR classification accuracy | BLOCKED | No valid input frame |
| Unknown/background rejection | NOT TESTED | No controlled negative fixture |
| Manual navigation controls | PASS | Controls rendered and responded |
| Exact RIO/FABLAB deployed semantics | FAIL | Production route text is stale |
| No automatic positioning claim | PASS | UI explicitly says no GPS or camera |
| Navigation offline after caching | PASS partial | Cached reload retained navigation shell |
| First visit offline | NOT TESTED | Requires fresh browser profile |
| Mobile layout | PASS emulated | 390 x 844 CSS viewport, no overflow |
| Android Chrome | NOT TESTED | No physical Android device |
| iPhone Safari | NOT TESTED | No physical iPhone |
| Installed Android/iPhone PWA | NOT TESTED | No installed PWA hardware |
| Memory leak/repeated initialization | NOT TESTED | Requires long-running hardware/profile test |
| Production readiness | FAIL | High-severity deployed model and route drift |

## Recommended Fix Priority

1. Publish and verify the intended 13-class RECON model/metadata pair; confirm Fluke 971 exists and Fluke 941 is absent in production.
2. Publish and verify the current navigation bundle; re-run the RIO-to-FABLAB step capture and destination-confirmation test.
3. Change exhibit status rendering so `UNKNOWN` or no input cannot be labeled `EXHIBIT DETECTED`.
4. Make intentional TTS cancellation quiet and test speech/card synchronization under rapid Previous/Next actions.
5. Add controlled Playwright tests for failed model downloads, offline first visit, cached model reuse, route switching, and duplicate chat requests.
6. Run real-device acceptance tests on Android Chrome and iPhone Safari, including camera permission, tab suspension, orientation, PWA mode, WebGL/ORT inference, and memory.
7. Triage active-path lint errors before using lint as a release gate.

## Final Verdict

**FAIL: not production-ready for the stated QA acceptance criteria.**

The app is usable for basic page rendering, local assistant interaction, manual cached navigation, and model asset retrieval. It is not acceptable to certify production exhibit recognition or the requested RIO/FABLAB navigation semantics until the deployed model and frontend bundle are brought into alignment and the blocked real-camera/device tests are completed.
