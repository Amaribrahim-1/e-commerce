export const sendSuccess = (res, statusCode, data) => {
  return res.status(statusCode).json({ status: 'success', data });
};
