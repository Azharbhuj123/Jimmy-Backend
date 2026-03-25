const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log('ℹ️  Admin account already exists, skipping seed.');
      return;
    }

    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const name = 'Super Admin';

    await User.create({ name, email, password, role: 'admin' });
    console.log(`✅ Admin seeded: ${email}`);
  } catch (err) {
    console.error('❌ Admin seed failed:', err.message);
  }
};

module.exports = seedAdmin;
