const Contact = require('../../models/Contact');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPaginationOptions, buildPaginationMeta } = require('../../utils/pagination');

const getContacts = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPaginationOptions(req.query);
  const { search, isRead } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
    ];
  }
  if (isRead !== undefined) filter.isRead = isRead === 'true';

  const [contacts, total] = await Promise.all([
    Contact.find(filter).sort(sort).skip(skip).limit(limit),
    Contact.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, contacts, buildPaginationMeta(total, page, limit));
});

const markAsRead = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { isRead: true },
    { new: true }
  );
  if (!contact) throw new ApiError(404, 'Contact not found');
  ApiResponse.success(res, { contact }, 'Marked as read');
});

const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndDelete(req.params.id);
  if (!contact) throw new ApiError(404, 'Contact not found');
  ApiResponse.success(res, {}, 'Contact deleted');
});

module.exports = { getContacts, markAsRead, deleteContact };
