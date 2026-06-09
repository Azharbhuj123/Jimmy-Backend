const { google } = require("googleapis");
const path = require("path");
const SheetConfig = require("./src/models/SheetConfig");
const mongoose = require("mongoose");
require("dotenv").config();

async function checkRow() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const authOptions = { scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] };
  if (process.env.GOOGLE_CREDENTIALS) {
    authOptions.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else {
    authOptions.keyFile = path.join(__dirname, "src/credentials.json");
  }
  const auth = new google.auth.GoogleAuth(authOptions);
  const sheets = google.sheets({ version: "v4", auth });

  // Check Samsung
  const samsungConfig = await SheetConfig.findOne({ deviceType: 'samsung' });
  const samsungResp = await sheets.spreadsheets.values.get({
    spreadsheetId: samsungConfig.spreadsheetId,
    range: `${samsungConfig.sheetName}!${samsungConfig.dataRange}`,
  });
  for (let i = 0; i < samsungResp.data.values.length; i++) {
      const row = samsungResp.data.values[i] || [];
      const rawName = (row[samsungConfig.modelColumn] || "").trim();
      if (rawName === "S23") {
          console.log(`[Samsung] Row ${i}:`, row);
          console.log(`Non-empties:`, row.filter(cell => String(cell).trim() !== ""));
      }
  }

  // Check Pixel
  const pixelConfig = await SheetConfig.findOne({ deviceType: 'pixel' });
  if (pixelConfig) {
    const pixelResp = await sheets.spreadsheets.values.get({
      spreadsheetId: pixelConfig.spreadsheetId,
      range: `${pixelConfig.sheetName}!${pixelConfig.dataRange}`,
    });
    for (let i = 0; i < pixelResp.data.values.length; i++) {
        const row = pixelResp.data.values[i] || [];
        const rawName = (row[pixelConfig.modelColumn] || "").trim();
        if (rawName.toUpperCase() === "NEW") {
            console.log(`[Pixel] Row ${i}:`, row);
            console.log(`Non-empties:`, row.filter(cell => String(cell).trim() !== ""));
        }
    }
  }
  
  process.exit();
}

checkRow();
