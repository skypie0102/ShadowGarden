The isolated server/edge-token.js module is a JavaScript port of drm.py from
https://github.com/rany2/edge-tts at bd44c1d1aaebdc1db7f47456ee12431b42ec7cac.
Upstream copyright: rany and edge-tts contributors. License: LGPL-3.0-only.
Port copyright: ShadowGarden contributors, 2026.

Changes: unsigned 32-bit JavaScript arithmetic using Math.imul, BigInt timestamp
conversion, removal of Python session/global clock state and unused helpers.
The protocol hash is exported as edgeToken(unixSeconds). Golden tests compare
its output with the pinned upstream Python implementation.

The complete corresponding source, application source and build instructions
are available in this repository. To modify or relink the module, edit
server/edge-token.js, install dependencies with npm ci, and run npm run check.
The Pages build bundles the application and this module from source.

UPSTREAM-LICENSE retains the upstream license notice. GPL-3.0.txt and
LGPL-3.0.txt provide the complete applicable license texts.
