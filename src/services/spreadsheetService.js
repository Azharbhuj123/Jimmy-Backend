const { google } = require("googleapis");
const path = require("path");
const Product = require("../models/Product");
const SheetConfig = require("../models/SheetConfig");

const authOptions = {
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
};

console.log("🛠️  Credential Debug:", {
  hasEnvVar: !!process.env.GOOGLE_CREDENTIALS,
  envVarLength: process.env.GOOGLE_CREDENTIALS?.length || 0,
});

if (process.env.GOOGLE_CREDENTIALS) {
  try {
    let credsStr = process.env.GOOGLE_CREDENTIALS;
    if (credsStr.includes('\\"')) {
      credsStr = credsStr.replace(/\\"/g, '"');
    }
    if (credsStr.includes('\\\\n')) {
      credsStr = credsStr.replace(/\\\\n/g, '\\n');
    }
    authOptions.credentials = JSON.parse(credsStr);
    console.log("ℹ️ Using Google credentials from Environment Variable");
  } catch (err) {
    console.error(
      "❌ Error parsing GOOGLE_CREDENTIALS env var. Falling back to file. Error:", err.message
    );
    authOptions.keyFile = path.join(__dirname, "../credentials.json");
  }
} else {
  console.log("ℹ️ GOOGLE_CREDENTIALS not found in env, using local file.");
  authOptions.keyFile = path.join(__dirname, "../credentials.json");
}

const auth = new google.auth.GoogleAuth(authOptions);
const sheets = google.sheets({ version: "v4", auth });

/**
 * Converts currency string "$1,234.56" to number 1234.56
 */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  return parseFloat(String(priceStr).replace(/[$,\s]/g, "")) || 0;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * NEW: Generic model parser
 */
function parseModelFromRow(row, config, lastSeenModelName = "") {
  let rawName = (row[config.modelColumn] || "").trim();
  
  if (!rawName) {
    rawName = lastSeenModelName;
  }

  if (!rawName || rawName.toLowerCase() === "model") return null;

  // Skip header-like rows (section markers in sheet)
  if (
    rawName.toLowerCase().includes("deduction") ||
    rawName.toLowerCase().includes("camera") ||
    rawName.toLowerCase().includes("battery")
  ) {
    return null;
  }

  // Normalize spaces and trim for consistent matching
  const cleanName = rawName.replace(/\s+/g, " ");

  let name = cleanName;
  let storage = "N/A";
  let carrier = "N/A";

  // Check if carrier is explicitly in a separate column (like Column B for Samsung)
  let explicitCarrierMatch = false;
  let col1Carrier = "";
  if (config.hasCarrier && config.deviceType !== "apple_watch") {
      // Check column B
      if (row[1]) {
          const cMatch = row[1].match(/(Unlocked|Locked)/i);
          if (cMatch) {
              carrier = cMatch[1];
              explicitCarrierMatch = true;
              col1Carrier = row[1].trim(); // might be "Carrier Locked"
          }
      }
  }

  // Attempt to extract storage
  if (config.hasStorage && config.deviceType !== "apple_watch") {
    const storageMatch = cleanName.match(/(\d+(?:GB|TB|MB))/i);
    if (storageMatch) {
      storage = storageMatch[1];
      name = cleanName.substring(0, cleanName.indexOf(storage)).trim();
    }
  }

  // Attempt to extract carrier from name if not explicitly found in column B
  if (config.hasCarrier && !explicitCarrierMatch && config.deviceType !== "apple_watch") {
    const carrierMatch = cleanName.match(/(Unlocked|Locked)/i);
    if (carrierMatch) {
      carrier = carrierMatch[1];
      if (name === cleanName) {
        // If storage wasn't found, try to strip carrier from name
        name = cleanName.substring(0, cleanName.indexOf(carrier)).trim();
      }
    }
  }

  // Build a unique sheetRowKey. If carrier is in column B (like Samsung), append it so rows are unique.
  let sheetRowKey = cleanName;
  if (explicitCarrierMatch && config.deviceType === "samsung") {
      sheetRowKey = `${cleanName} ${col1Carrier}`;
  }

  return { name: name || cleanName, storage, carrier, sheetRowKey };
}

/**
 * NEW: Config-driven product lookup
 */
async function findProductInDB(parsed, config) {
  if (parsed.sheetRowKey) {
    const p = await Product.findOne({ sheetRowKey: parsed.sheetRowKey });
    if (p) return p;
  }

  // Calculate the expected slug to handle slight punctuation differences (e.g. iPad Pro 13" vs iPad Pro 13)
  const namePart = parsed.name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const storagePart = parsed.storage && parsed.storage !== "N/A" ? parsed.storage.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") : "";
  const carrierPart = parsed.carrier && parsed.carrier !== "N/A" ? parsed.carrier.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") : "";
  const expectedSlug = [namePart, storagePart, carrierPart].filter(Boolean).join("-");

  console.log(`[DEBUG] findProductInDB expectedSlug: ${expectedSlug}`);
  // If a product with the exact expected slug exists, just return it! 
  // This prevents E11000 duplicate key errors and gracefully updates the existing product.
  const bySlug = await Product.findOne({ slug: expectedSlug });
  console.log(`[DEBUG] findProductInDB bySlug found: ${!!bySlug}`);
  if (bySlug) return bySlug;

  const query = {
    name: { $regex: new RegExp(`^${escapeRegex(parsed.name)}$`, "i") },
    deviceType: config.deviceType,
  };
  
  if (parsed.storage !== "N/A") {
      query.storage = { $regex: new RegExp(`^${escapeRegex(parsed.storage)}$`, "i") };
  }
  
  if (parsed.carrier !== "N/A") {
      query.carrier = { $regex: new RegExp(`^${escapeRegex(parsed.carrier)}$`, "i") };
  }

  return Product.findOne(query);
}

/**
 * Sync a specific sheet configuration
 */
async function syncSheetData(config) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${config.sheetName}!${config.dataRange}`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.log(`⚠️ No data found in spreadsheet for ${config.deviceType}.`);
      return;
    }

    console.log(
      `📊 Found ${rows.length - 1} products in ${config.deviceType} spreadsheet. Syncing...`,
    );

    // Row 0 is headers, Row 1 is first product data
    let lastSeenModelName = "";

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const rawName = (row[config.modelColumn] || "").trim();
      const knownHeaderWords = ["model", "new", "sealed", "open", "grade a", "grade b"];
      if (rawName && !knownHeaderWords.includes(rawName.toLowerCase()) && !rawName.toLowerCase().includes("deduction")) {
          lastSeenModelName = rawName;
      }

      const parsed = parseModelFromRow(row, config, lastSeenModelName);
      if (!parsed) {
        console.log(`⚠️ Skipped row in ${config.deviceType}:`, row[config.modelColumn]);
        continue; // skipped row
      }

      const { name, storage, carrier, sheetRowKey } = parsed;

      // Base Price logic
      let basePrice = 0;
      // Some sheets don't have a "NEW" column, they just start with Grade A.
      // Assuming base price might come from the first condition column if there isn't a dedicated NEW column.
      // But for simplicity, we can set basePrice to 0 if it's not determinable, or just leave it.
      // Here we assume NEW is column 2 if it exists, otherwise it's 0. We could configure this in SheetConfig if needed.
      const basePriceStr = (row[2] || "").trim(); // This might not be base price for all sheets. Need to be careful.
      basePrice = parsePrice(basePriceStr);
      
      if (basePrice === 0 && basePriceStr.toLowerCase().includes("ask")) {
        console.log(`ℹ️ Skipping ${sheetRowKey}: Price is "ASK"`);
        continue;
      }

      // Skip category headers (rows with only 1 non-empty cell)
      const nonEmpties = row.filter(cell => String(cell).trim() !== "");
      if (nonEmpties.length <= 1) {
          console.log(`ℹ️ Skipping category header row: ${rawName}`);
          continue;
      }

      // Skip section divider rows that contain "Shipping" or "Pickup" as column markers
      // These are rows like: "S23 | | | ... | Shipping > | | ... | Pickup"
      const hasShippingPickup = row.some(cell => 
          String(cell).trim().toLowerCase().includes("shipping") || 
          String(cell).trim().toLowerCase() === "pickup"
      );
      if (hasShippingPickup) {
          console.log(`ℹ️ Skipping section divider row: ${rawName}`);
          continue;
      }

      // Skip header rows that were accidentally parsed (column labels)
      const col1Str = (row[1] || "").trim().toUpperCase();
      const col2Str = (row[2] || "").trim().toUpperCase();
      const col3Str = (row[3] || "").trim().toUpperCase();
      const headerWords = ["NEW", "SEALED", "OPEN", "A / HSO", "B GRADE", "GRADE A"];
      
      if (
          headerWords.includes(col1Str) || 
          headerWords.includes(col2Str) || 
          headerWords.includes(col3Str) ||
          basePriceStr.toUpperCase() === "NEW" || 
          basePriceStr.toUpperCase() === "SEALED" || 
          basePriceStr.toUpperCase() === "OPEN"
      ) {
        console.log(`ℹ️ Skipping header labels row for ${sheetRowKey}`);
        continue;
      }

      console.log(`🔍 Syncing: "${sheetRowKey}"...`);

      try {
          let product = await findProductInDB(parsed, config);

          if (!product) {
        console.log(
          `✨ Creating new product: "${sheetRowKey}" -> Parsed as: [Name: "${name}", Storage: "${storage}", Carrier: "${carrier}"]`,
        );
        
        // Generate a basic slug
        const slug = `${name}-${storage}-${carrier}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        
        // Initialize the Condition step
        const conditionStep = {
            title: "Condition",
            key: config.conditionStepKey || "Condition",
            isRequired: true,
            order: 0,
            options: config.conditionColumns.map(col => {
                if (col.label.toLowerCase() === 'doa') return null;
                return {
                    label: col.label,
                    subtext: "",
                    value: col.label.toLowerCase().replace(/\s+/g, '_'),
                    shipPriceModifier: 0,
                    pickupPriceModifier: 0,
                    modifierType: "fixed"
                };
            }).filter(Boolean)
        };

        // We need a default brand if creating, or admin must set it. 
        // We will just let mongoose validations pass if possible, or set a dummy. 
        // Wait, brandId is required in Product model. 
        // We might need to find a dummy brand or skip if brand is absolutely required and missing.
        // Actually, we can fetch the first brand from DB to use as default.
        const Brand = require("../models/Brand");
        let brandSlug = 'apple';
        if (config.deviceType === 'samsung') brandSlug = 'samsung';
        else if (config.deviceType === 'pixel') brandSlug = 'google';
        
        let targetBrand = await Brand.findOne({ slug: brandSlug });
        if (!targetBrand) {
            targetBrand = await Brand.findOne();
        }
        
        product = new Product({
            name: name,
            deviceType: config.deviceType,
            sheetRowKey: sheetRowKey,
            storage: storage === 'N/A' ? '' : storage,
            carrier: carrier === 'N/A' ? '' : carrier,
            slug: slug + '-' + Date.now(), // Ensure uniqueness
            steps: [conditionStep],
            basePrice: 0,
            brandId: targetBrand ? targetBrand._id : null,
            images: [],
            isActive: true,
        });
      }

      // Update product base prices
      if (basePrice > 0) {
          product.basePrice = basePrice;
          product.avgResaleValue = basePrice + 100;
      }

      // Update condition modifiers in steps
      const conditionStep = product.steps.find(
        (s) =>
          s.key === config.conditionStepKey || s.title.toLowerCase().includes("condition"),
      );

      if (conditionStep) {
        let updatedCount = 0;
        
        config.conditionColumns.forEach(({ label, shipColIndex, pickupColIndex }) => {
            // Ignore DOA as per user instruction
            if (label.toLowerCase() === 'doa') return;
            
            const option = conditionStep.options.find(
                (o) => o.label.toLowerCase() === label.toLowerCase()
            );
            
            if (option) {
                option.shipPriceModifier = parsePrice(row[shipColIndex]);
                option.pickupPriceModifier = parsePrice(row[pickupColIndex]);
                updatedCount++;
            }
        });
        
        // Force Mongoose to recognize the nested array modification
        product.markModified('steps');
      } else {
        console.log(`   ⚠️ No "Condition" step found for ${sheetRowKey}`);
      }

      await product.save();
      console.log(`✅ Updated: ${sheetRowKey}`);
      } catch (err) {
          console.error(`❌ Error updating product "${sheetRowKey}":`, err.message);
      }
    }

    console.log(`🏁 Spreadsheet sync completed successfully for ${config.deviceType}.`);
  } catch (error) {
    console.error(`❌ Error syncing spreadsheet data for ${config.deviceType}:`, error);
  }
}

/**
 * Sync all active sheets
 */
async function syncSpreadsheetData() {
    const configs = await SheetConfig.find({ isActive: true });
    for (const config of configs) {
        await syncSheetData(config);
    }
}

/**
 * Sync a specific device type
 */
async function syncSheetByDeviceType(deviceType) {
    const config = await SheetConfig.findOne({ deviceType, isActive: true });
    if (!config) {
        throw new Error(`No active sheet configuration found for deviceType: ${deviceType}`);
    }
    await syncSheetData(config);
}

module.exports = { syncSpreadsheetData, syncSheetByDeviceType };
