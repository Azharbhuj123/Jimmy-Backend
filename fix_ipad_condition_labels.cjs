/**
 * One-time migration: Fix condition step option labels & subtexts for all iPad products.
 * Run: node fix_ipad_condition_labels.cjs
 */
const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// New labels & subtexts for condition options (index 0–3)
const CONDITION_UPDATES = [
  {
    label: "Mint Condition",
    subtext: "No scratches, like new.",
  },
  {
    label: "Good Condition",
    subtext: "Minor wear and tear, fully functional — device only",
  },
  {
    label: "Fair Condition",
    subtext:
      "Front glass broken or visible damage — fully functional or may need repair",
  },
  {
    label: "Damaged Condition",
    subtext:
      "Front glass cracked without LCD damage or back glass cracked - phone in somewhat rough condition",
  },
];

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected!\n");

  const Products = mongoose.connection.collection("products");

  // Find all iPad products (case-insensitive)
  const ipads = await Products.find({
    deviceType: /ipad/i,
  }).toArray();

  console.log(`Found ${ipads.length} iPad product(s).\n`);

  let updatedProducts = 0;
  let updatedSteps = 0;

  for (const product of ipads) {
    const steps = product.steps || [];
    let productModified = false;

    // Find the condition step (key or title contains "condition")
    const conditionStepIdx = steps.findIndex(
      (s) =>
        s.key?.toLowerCase().includes("condition") ||
        s.title?.toLowerCase().includes("condition"),
    );

    if (conditionStepIdx === -1) {
      console.log(
        `  ⚠️  No condition step found for: ${product.name} — skipping`,
      );
      continue;
    }

    const step = steps[conditionStepIdx];
    const options = step.options || [];

    const updateFields = {};

    CONDITION_UPDATES.forEach(({ label, subtext }, i) => {
      if (options[i] !== undefined) {
        updateFields[
          `steps.${conditionStepIdx}.options.${i}.label`
        ] = label;
        updateFields[
          `steps.${conditionStepIdx}.options.${i}.subtext`
        ] = subtext;
        productModified = true;
      } else {
        console.log(
          `  ℹ️  ${product.name}: no option at index ${i} — skipped`,
        );
      }
    });

    if (productModified) {
      await Products.updateOne(
        { _id: product._id },
        { $set: updateFields },
      );
      updatedProducts++;
      updatedSteps++;
      console.log(`  ✅ Updated: ${product.name}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Done. Updated ${updatedProducts} iPad product(s).`);
  console.log(`========================================\n`);

  // Preview the result for the first iPad
  if (ipads.length > 0) {
    const sample = await Products.findOne({ _id: ipads[0]._id });
    const steps = sample.steps || [];
    const condStep = steps.find(
      (s) =>
        s.key?.toLowerCase().includes("condition") ||
        s.title?.toLowerCase().includes("condition"),
    );
    if (condStep) {
      console.log(`Preview — "${sample.name}" condition options:`);
      (condStep.options || []).slice(0, 4).forEach((opt, i) => {
        console.log(`  [${i}] ${opt.label} — "${opt.subtext}"`);
      });
    }
  }

  await mongoose.disconnect();
  console.log("\nDisconnected. All done!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
