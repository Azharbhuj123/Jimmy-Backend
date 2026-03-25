const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sendPasswordResetEmail } = require('./email.service');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET);

const register = async ({ name, email, password, phone }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'Email is already registered.');

  const user = await User.create({ name, email, password, phone, role: 'user' });
  const token = generateToken(user._id);
  return { user, token };
};

const login = async ({ email, password, requiredRole }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new ApiError(401, 'Invalid email or password.');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password.');

  if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated.');

  if (requiredRole && user.role !== requiredRole) {
    throw new ApiError(403, `Access denied. This endpoint requires role: ${requiredRole}.`);
  }

  const token = generateToken(user._id);
  return { user, token };
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  // Always respond success to prevent email enumeration
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;
  await sendPasswordResetEmail(user, resetUrl);
};

const resetPassword = async (rawToken, newPassword) => {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) throw new ApiError(400, 'Reset token is invalid or has expired.');

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  const token = generateToken(user._id);
  return { user, token };
};

module.exports = { register, login, forgotPassword, resetPassword };
