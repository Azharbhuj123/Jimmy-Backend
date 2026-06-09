const mongoose = require('mongoose');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();
const SheetConfig = require('./src/models/SheetConfig');

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  return parseFloat(String(priceStr).replace(/[$,\s]/g, "")) || 0;
}

async function debugUpdate() {
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
  for (let i = 23; i <= 28; i++) {
    const row = rows[i];
    console.log(`Row ${i}:`, row);
  }
  process.exit(0);
}

debugUpdate();
