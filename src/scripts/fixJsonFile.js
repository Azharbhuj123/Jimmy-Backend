const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
    console.error("Please provide a file path to the JSON file.");
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const products = JSON.parse(rawData);

    console.log(`Processing ${products.length} products...`);

    const updatedProducts = products.map(product => {
        if (!product.steps) return product;

        product.steps = product.steps.map(step => {
            if (step.key.toLowerCase() === "condition") {
                step.options = step.options.map(option => {
                    const label = option.label.toLowerCase();

                    // 1. Brand New
                    if (label === "brand new") {
                        option.subtext = "Sealed in Box.";
                    }
                    // 2. Mint Condition
                    else if (label === "mint condition") {
                        option.subtext = "No scratches, like new.";
                    }
                    // 3. Good Condition (Removing device only)
                    else if (label === "good condition") {
                        option.subtext = "Minor wear and tear, fully functional.";
                    }
                    // 4. Fair Condition (Removing device only)
                    else if (label === "fair condition") {
                        option.subtext = "Heavy scratches, fully functional.";
                    }
                    // 5. Damaged Condition
                    else if (label === "damaged condition") {
                        option.subtext = "Fully functional. Back glass must be in good condition for this pricing.";
                    }

                    return option;
                });
            }
            return step;
        });

        return product;
    });

    const outputFileName = 'Updated_' + path.basename(filePath);
    const outputPath = path.join(path.dirname(filePath), outputFileName);

    fs.writeFileSync(outputPath, JSON.stringify(updatedProducts, null, 2));

    console.log(`Success! Updated file saved as: ${outputPath}`);
} catch (error) {
    console.error("Error processing file:", error);
}
