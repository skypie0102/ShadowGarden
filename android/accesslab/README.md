# Local access experiment

This is a separate test application, not ShadowGarden's release app. Its debug
manifest allows Internet access and trusts the bundled test CA only for
`localhost`; cleartext is disabled. The CA and PKCS#12 server certificate are
public, disposable fixtures for the loopback server. The fixture keystore
password is `accesslab-fixture`; these files must never be used for production
TLS, authentication or signing. The CA's private key was discarded.

The instrumentation APK uses the fixture server key to host a mock HTTPS
service. No production credentials or content are used. The mock emulates only
specific responses needed for the experiment; it does not run the real server
or Turnstile. The main ShadowGarden app and its release manifest do not inherit
this module's permission or CA.

The optional `fixture/server.mjs` binds only to loopback and executes the actual
access handlers with an in-memory SQLite-backed D1 substitute, a generated catalog
and mocked Siteverify/B2 responses. It blocks all other outgoing `fetch` calls.
Run `node --test android/accesslab/fixture/server.test.mjs` from the repository
root to check the fixture directly (Node 24 is used in CI). With an emulator
connected, `bash android/accesslab/run-emulator-tests.sh` starts the fixture,
configures ADB reverse forwarding and runs the Android instrumentation suite.
The real-handler WebView case skips when the fixture isn't explicitly enabled.
The test server and credentials are test-only and must never be exposed or used
for production.
