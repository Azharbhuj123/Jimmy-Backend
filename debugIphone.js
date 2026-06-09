const mongoose = require('mongoose');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();
const SheetConfig = require('./src/models/SheetConfig');

async function debugIphone() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jimmy");
  const config = await SheetConfig.findOne({ deviceType: 'iphone' });
  
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
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    console.log(`Row ${i}:`, rows[i]);
  }
  process.exit(0);
}

debugIphone();
