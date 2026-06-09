const mongoose = require('mongoose');
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();
const SheetConfig = require('./src/models/SheetConfig');

async function checkSheetRow() {
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
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].includes("S25 EDGE")) {
        console.log(`Row ${i}:`, rows[i]);
        if (i+1 < rows.length) console.log(`Row ${i+1}:`, rows[i+1]);
        if (i+2 < rows.length) console.log(`Row ${i+2}:`, rows[i+2]);
    }
  }
  process.exit(0);
}

checkSheetRow();
