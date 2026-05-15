const { google } = require("googleapis");
const path = require("path");
const Product = require("../models/Product");

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

/**
 * Parses a string like "iPhone 17 Pro Max 256GB Unlocked"
 * into { name, storage, carrier }
 */
function parseProductName(fullName) {
  if (!fullName) return null;

  // Normalize spaces and trim
  const cleanName = fullName.trim().replace(/\s+/g, " ");

  // Look for storage pattern: digits followed by GB or TB (case insensitive)
  const storageMatch = cleanName.match(/(\d+(?:GB|TB|MB))/i);
  if (!storageMatch) return null; // If no storage, likely not a product row

  const storage = storageMatch[1];

  // Look for carrier: Unlocked or Locked
  const carrierMatch = cleanName.match(/(Unlocked|Locked)/i);
  const carrier = carrierMatch ? carrierMatch[1] : "Unlocked"; // Default to Unlocked if not specified? Or null?

  // Name is everything before the storage
  const storageIndex = cleanName.indexOf(storage);
  const name = cleanName.substring(0, storageIndex).trim();

  // If name is empty or just special characters, it's not a valid product
  if (!name || name.length < 2) return null;

  return { name, storage, carrier };
}

/**
 * Converts currency string "$1,234.56" to number 1234.56
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  return parseFloat(priceStr.replace(/[$,\s]/g, "")) || 0;
}

async function syncSpreadsheetData() {
  try {
    const spreadsheetId = "1w_l4I-HhbvnvC1R3EGu_YaW-K1F9NZBvf7vOJDgHPYA";
    const range = "Sheet1!A2:V323"; // Fetching all relevant columns

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.log("⚠️ No data found in spreadsheet.");
      return;
    }

    console.log(
      `📊 Found ${rows.length - 1} products in spreadsheet. Syncing...`,
    );

    // Row 0 is headers, Row 1 is first product data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const fullName = (row[1] || "").trim();
      if (!fullName || fullName.toLowerCase() === "model") continue; // Skip header or empty

      const parsed = parseProductName(fullName);
      if (!parsed) {
        console.log(
          `⚠️ Skipping row ${i + 1}: Could not parse name "${fullName}"`,
        );
        continue;
      }

      const { name, storage, carrier } = parsed;
      const basePriceStr = (row[2] || "").trim();
      const basePrice = parsePrice(basePriceStr);

      if (basePrice === 0 && basePriceStr.toLowerCase().includes("ask")) {
        console.log(`ℹ️ Skipping ${fullName}: Price is "ASK"`);
        continue;
      }

      const avgResaleValue = basePrice + 100;

      // Modifiers from Columns J-N (Shipping) and Q-U (Pickup)
      const modifiers = {
        "Brand New": { ship: parsePrice(row[9]), pickup: parsePrice(row[16]) },
        "Mint Condition": {
          ship: parsePrice(row[10]),
          pickup: parsePrice(row[17]),
        },
        "Good Condition": {
          ship: parsePrice(row[11]),
          pickup: parsePrice(row[18]),
        },
        "Fair Condition": {
          ship: parsePrice(row[12]),
          pickup: parsePrice(row[19]),
        },
        "Damaged Condition": {
          ship: parsePrice(row[13]),
          pickup: parsePrice(row[20]),
        },
      };

      // Escape name for regex and handle special characters like (2020)
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      console.log(`🔍 Syncing: "${fullName}"...`);

      // Find the product in DB
      // We use a more flexible search for name to handle slight variations
      const product = await Product.findOne({
        name: { $regex: new RegExp(`^${escapedName}$`, "i") },
        storage: { $regex: new RegExp(`^${storage}$`, "i") },
        carrier: { $regex: new RegExp(`^${carrier}$`, "i") },
      });

      if (!product) {
        console.log(
          `❌ Product not found in DB: "${fullName}" -> Parsed as: [Name: "${name}", Storage: "${storage}", Carrier: "${carrier}"]`,
        );
        continue;
      }

      // Update product fields
      product.basePrice = basePrice;
      product.avgResaleValue = avgResaleValue;

      // Update condition modifiers in steps
      const conditionStep = product.steps.find(
        (s) =>
          s.key === "Condition" || s.title.toLowerCase().includes("condition"),
      );

      if (conditionStep) {
        let updatedCount = 0;
        conditionStep.options.forEach((option) => {
          const mods = modifiers[option.label];
          if (mods) {
            option.shipPriceModifier = mods.ship;
            option.pickupPriceModifier = mods.pickup;
            updatedCount++;
          }
        });
        // console.log(`   - Updated ${updatedCount} condition options for ${fullName}`);
      } else {
        console.log(`   ⚠️ No "Condition" step found for ${fullName}`);
      }

      await product.save();
      console.log(`✅ Updated: ${fullName} (Base: $${basePrice})`);
    }

    console.log("🏁 Spreadsheet sync completed successfully.");
  } catch (error) {
    console.error("❌ Error syncing spreadsheet data:", error);
  }
}

module.exports = { syncSpreadsheetData };
