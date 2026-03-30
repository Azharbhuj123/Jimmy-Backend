const multer = require("multer");

const storage = multer.memoryStorage(); // Save file in memory as buffer
const upload = multer({ storage });

module.exports = upload;
