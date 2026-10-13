# Exhibit retraining — research-only local export

Branch: `optimize/video-route-transition-mobile`

## Changes made

- Preserved consent-gated capture of uncertain exhibit frames and user-corrected labels in the browser's IndexedDB (`taylor-exhibit-retraining`).
- Removed automatic requests to `/api/exhibit-retraining/sync` from the exhibit UI because the deployed endpoint returned HTTP 405.
- Added an explicit **Export saved research samples** control on the exhibit recognition screen (outside tour mode).
- Exported records as JSON with embedded image data URLs, prediction metadata, proposed labels, and review status.
- Export does **not** delete local samples or mark them synchronized; model inference and deployed MobileNet weights are unchanged.

## Research limitations

- Each browser/device retains its own data. The researcher must export separately on each device; browser storage can be evicted or cleared.
- The export is a browser download, not an upload to the researcher's computer or a centralized database.
- Camera images require participant consent and careful handling; review samples before training.
- Export has not yet been verified on deployed Vercel or physical Android/iPhone devices.

## Relevant commits

- `85160313530537298d387320d2ef8aa90f37e7cb` — export serializer.
- `1d687fd76d1dae18b67a0e318873c3249f1962a7` — disable autosync and add export UI.
