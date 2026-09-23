// Inferred handler. See RECONSTRUCTION_LOG.md and docs/API_CONTRACTS.md.
import {endpoint} from '../server/http.js';
import {adminAccess} from '../server/security.js';
export const onRequest = endpoint(adminAccess);
