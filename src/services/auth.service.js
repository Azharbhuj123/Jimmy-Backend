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

  const resetCode = Math.floor(10000 + Math.random() * 90000).toString(); // Random 5-digit code
  const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');

  user.resetPasswordCode = hashedCode;
  user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail(user, resetCode);
};

const resetPassword = async (resetCode, newPassword) => {
  const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');

  const user = await User.findOne({
    resetPasswordCode: hashedCode,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordCode +resetPasswordExpires');

  if (!user) throw new ApiError(400, 'Reset code is invalid or has expired.');

  user.password = newPassword;
  user.resetPasswordCode = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  const token = generateToken(user._id);
  return { user, token };
};

module.exports = { register, login, forgotPassword, resetPassword };
