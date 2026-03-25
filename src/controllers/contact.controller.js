const Contact = require('../models/Contact');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const submitContact = asyncHandler(async (req, res) => {
  const contact = await Contact.create(req.body);
  ApiResponse.success(res, { contact }, 'Message received. We will get back to you shortly.', 201);
});

module.exports = { submitContact };
