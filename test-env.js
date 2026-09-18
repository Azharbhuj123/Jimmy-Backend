require('dotenv').config();
console.log("Raw from env:");
console.log(process.env.GOOGLE_CREDENTIALS.substring(0, 100));
try {
  let cleaned = process.env.GOOGLE_CREDENTIALS;
  if (cleaned.startsWith('"{') || cleaned.includes('\\"')) {
     cleaned = cleaned.replace(/\\"/g, '"');
  }
  JSON.parse(cleaned);
  console.log("Parse success with cleaning");
} catch(e) {
  console.log("Clean parse failed:", e.message);
}
