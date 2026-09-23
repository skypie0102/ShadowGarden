// Inferred handler. See RECONSTRUCTION_LOG.md and docs/API_CONTRACTS.md.
import {endpoint} from '../../server/http.js';
import {media} from '../../server/books.js';
export const onRequest = endpoint(media);
