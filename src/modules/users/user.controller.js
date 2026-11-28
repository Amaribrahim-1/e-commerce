import { sendSuccess } from '../../common/http/sendSuccess.js';

// GET /users/me. No service call: the authenticate middleware has already
// loaded the user and checked it, and there is no business rule left to apply.
// A service that only returned req.currentUser would be a layer with no job.
// The user is wrapped in { user } so the shape matches register and login.
export const getMe = (req, res) => {
  sendSuccess(res, 200, { user: req.currentUser });
};
