const Contact = require('../models/Contact');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { sendContactNotificationEmail } = require('../services/email.service');

const submitContact = asyncHandler(async (req, res) => {
  const contact = await Contact.create(req.body);

  // Send notification email to admin
  await sendContactNotificationEmail(contact);

  ApiResponse.success(res, { contact }, 'Message received. We will get back to you shortly.', 201);
});

module.exports = { submitContact };
