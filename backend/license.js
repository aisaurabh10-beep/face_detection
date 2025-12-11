
const os = require("os");
const crypto = require("crypto");

const EXPIRY = new Date("2026-02-10"); // 2 months

async function validateLicense() {
  if (new Date() > EXPIRY) {
    console.error("❌ License Expired");
    process.exit(1);
  }
  // Note: If license validation needs to make HTTP requests, use fetch() instead of axios
}

module.exports = { validateLicense };
