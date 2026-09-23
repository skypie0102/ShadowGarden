// Inferred handler. See RECONSTRUCTION_LOG.md and docs/API_CONTRACTS.md.
import {endpoint} from '../../server/http.js';
import {seriesBanner} from '../../server/admin.js';
export const onRequest = endpoint(seriesBanner);
