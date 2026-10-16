# Sparkit

Standalone electrical apprentice toolkit. ReceiptWise is a separate product.

- Keep the shipped app buildless: HTML, CSS and vanilla JavaScript.
- Numerical logic belongs in `calculators.js`; worksheet persistence in
  `worksheets.js`. Keep both testable without a browser.
- Never turn a numerical comparison into a claim of installation compliance.
- Rules/reference content needs authoritative sources, jurisdiction and a
  checked date. Do not copy paid standards or unverified tables.
- Worksheets stay on the user's device. Never commit exports, personal data,
  tokens, environment files, browser profiles or test artifacts.
- Test with `npm test`, then exercise the affected flows in a browser. Include
  mobile layout and offline behavior for app-shell changes.
- Increment the service-worker cache version for app-shell releases. Scope
  caches to this app; never cache APIs or arbitrary off-origin requests.
- Work on a `codex/` branch and use a focused PR after the initial import.
- Publishing uses GitHub Pages. No server/database or credentials are needed.

Use an independent checking agent for meaningful calculator/persistence changes.
