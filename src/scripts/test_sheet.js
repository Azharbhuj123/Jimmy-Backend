const { google } = require("googleapis");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const SheetConfig = require("../models/SheetConfig");
const mongoose = require("mongoose");
const fs = require("fs");

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/quickycell";
  await mongoose.connect(uri);

  let authClient;
  const credsPath = path.join(__dirname, "../config/google-service-account.json");

  console.log("Checking path:", credsPath, fs.existsSync(credsPath));
  if (process.env.GOOGLE_CREDENTIALS) {
    authClient = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  } else if (fs.existsSync(credsPath)) {
    authClient = new google.auth.GoogleAuth({
      keyFile: credsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  } else {
      console.error("NO CREDENTIALS FOUND");
      process.exit(1);
  }

  const sheets = google.sheets({ version: "v4", auth: authClient });

  for (const dt of ["pixel", "samsung"]) {
    const config = await SheetConfig.findOne({ deviceType: dt });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${config.sheetName}!${config.dataRange}`,
    });
    console.log(`\n=== ${dt} First 5 Rows ===`);
    const rows = response.data.values.slice(0, 5);
    rows.forEach((r, i) => console.log(`Row ${i}:`, r.slice(0, 3).join(" | "))); // Print first 3 cols
  }
  process.exit(0);
}
run();
