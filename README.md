# Sparkit

Electrical calculations, worked examples, unit conversions and saved worksheets
for apprentices and electricians. Installable, buildless and usable offline.

## Develop

Run `npm test` (Node.js 18 or later). Run `npm run preview` and visit
http://127.0.0.1:5174. There are no packages to install or API keys to configure.

- Ohm's law: all six input pairs, with formula substitution.
- Voltage drop: solve drop, current, route length or cable mV/A/m.
- Balanced three-phase power: explicit star/delta connection.
- Conduit geometry and user-supplied cable correction factors.
- Length, area, voltage, current, resistance and power unit conversions.
- Named worksheets: original inputs, working and notes, stored on this device.
  Reopen and recalculate; export or restore a JSON backup from Saved. Restore
  skips IDs already on this device and preserves existing copies. Browser storage is
  device-specific, can be cleared by browser settings, and is not cloud sync.

Use current applicable table values and installation requirements. Numerical
comparisons are not installation approval. Reference links are signposts, with
source-check dates; there is no live regulatory feed or generated legal advice.

## Architecture and publishing

`calculators.js` is pure maths; `worksheets.js` validates and stores snapshots;
`app.js` connects them to the page. Only app-shell assets are cached offline.
GitHub Pages serves the root of `main`. Test and smoke-test before merging.

The repeatable browser smoke script is `scripts/browser-smoke.js`. Start the
local preview, open it in an isolated Playwright CLI session, then use
`playwright-cli run-code --filename scripts/browser-smoke.js`. It uses synthetic
worksheets only and checks 320/390/1280px layouts, backup restore and offline use.

## Origin

Toolkit source was extracted from
[sharma64/receiptwise](https://github.com/sharma64/receiptwise) at
`e1016055ad39ff6265f7ce844f0bcd39dd899cdf` on 16 October 2026. Full original
history stays in that repository; this repository starts with toolkit-only
source. ReceiptWise remains a separate app and backend.
