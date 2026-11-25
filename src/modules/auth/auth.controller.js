import { register } from './auth.service.js';
import { sendSuccess } from '../../common/http/sendSuccess.js';

// HTTP in, HTTP out. Reads the validated body, calls the service, and chooses
// the status code. No business rules here.
export const registerController = async (req, res) => {
  // The service picks the fields it needs (an allow-list), so the validated
  // body is passed as it is; there is no second list of fields to keep in sync.
  const { user, token } = await register(req.validated.body);

  // The token goes in the body; the client sends it back in the
  // "Authorization: Bearer <token>" header (see docs/02-decisions.md, P2-T02).
  sendSuccess(res, 201, { user, token });
};
