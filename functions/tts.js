import { endpoint } from "../server/http.js";
import { tts } from "../server/tts.js";
export const onRequest = endpoint(tts);
