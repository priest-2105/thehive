import { handleApi } from '../src/vercel-api.js';
export default { fetch: request => handleApi(request, 'draw') };
