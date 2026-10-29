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
