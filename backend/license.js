const readline = require("readline/promises");

const EXPIRY = new Date("2026-12-31");
const PRESET_PASSWORD = process.env.LICENSE_PASSWORD || "BtAttendance@2025";

async function promptPassword() {
  // 1) If provided via env, use it (CI/containers)
  const envPassword =
    process.env.LICENSE_PASSWORD_INPUT || process.env.LICENSE_PASSWORD;
  if (envPassword) return envPassword.trim();

  // 2) Dev fallback when no TTY (e.g., nodemon via IDE)
  if (!process.stdin.isTTY && process.env.NODE_ENV !== "production") {
    console.warn(
      "⚠️ No TTY detected; using preset license password in non-production."
    );
    return PRESET_PASSWORD;
  }

  // 3) Otherwise prompt the user (interactive shells)
  if (!process.stdin.isTTY) {
    throw new Error(
      "License password required but no TTY available. Provide LICENSE_PASSWORD_INPUT or LICENSE_PASSWORD env."
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question("Enter license password: ");
  await rl.close();
  return answer.trim();
}

async function validateLicense() {
  if (new Date() > EXPIRY) {
    console.error("❌ License expired");
    process.exit(1);
  }

  try {
    const password = await promptPassword();

    if (password !== PRESET_PASSWORD) {
      console.error("❌ Invalid license password");
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ License validation failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { validateLicense };

// 1) Ensure no password env is set: unset LICENSE_PASSWORD LICENSE_PASSWORD_INPUT
// 2) Run npm start (or node index.js); you should now see the prompt:
// Enter license password:
