const mongoose = require('mongoose');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();
const SheetConfig = require('./src/models/SheetConfig');

async function checkSamsung() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
  const config = await SheetConfig.findOne({ deviceType: 'samsung' });
  
  const authOptions = { scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] };
  if (process.env.GOOGLE_CREDENTIALS) {
      authOptions.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else {
      authOptions.keyFile = path.join(__dirname, "src/credentials.json");
  }
  
  const auth = new google.auth.GoogleAuth(authOptions);
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!${config.dataRange}`,
  });

  const rows = response.data.values;
  console.log("Headers:");
  console.log(rows[0]);
  console.log("Row 1 (first data row):");
  console.log(rows[1]);
  console.log("Row 2:");
  console.log(rows[2]);

  process.exit(0);
}

checkSamsung();
