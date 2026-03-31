const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const { user, token } = await authService.register({ name, email, password, phone });
  ApiResponse.success(res, { user, token }, 'Registration successful', 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await authService.login({ email, password });
  ApiResponse.success(res, { user, token }, 'Login successful');
});

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await authService.login({ email, password, requiredRole: 'admin' });
  ApiResponse.success(res, { user, token }, 'Admin login successful');
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  ApiResponse.success(res, {}, 'If that email exists, a reset link has been sent.');
});

const resetPassword = asyncHandler(async (req, res) => {
  const { code, password } = req.body;
  const result = await authService.resetPassword(code, password);
  ApiResponse.success(res, result, 'Password reset successful');
});

const getMe = asyncHandler(async (req, res) => {
  ApiResponse.success(res, { user: req.user }, 'Profile fetched');
});

module.exports = { register, login, adminLogin, forgotPassword, resetPassword, getMe };
