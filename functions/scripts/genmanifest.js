#!/usr/bin/env node
/**
 * Generates functions.yaml so Firebase CLI can discover functions
 * without needing the HTTP discovery server (which hangs locally).
 *
 * Usage: node scripts/genmanifest.js
 * Called automatically via npm run genmanifest (predeploy hook).
 */
"use strict";

const { execFileSync } = require("child_process");
const path = require("path");

const firebaseConfig = JSON.stringify({
  projectId: "vendorpass-495114",
  storageBucket: "vendorpass-495114.firebasestorage.app",
  databaseURL: "",
});

const binaryPath = path.resolve(__dirname, "../node_modules/.bin/firebase-functions");
const functionsDir = path.resolve(__dirname, "..");

console.log("Generating functions.yaml...");

try {
  execFileSync(process.execPath, [binaryPath, "."], {
    cwd: functionsDir,
    env: {
      ...process.env,
      FIREBASE_CONFIG: firebaseConfig,
      FUNCTIONS_MANIFEST_OUTPUT_PATH: path.join(functionsDir, "functions.yaml"),
    },
    stdio: "inherit",
  });
  console.log("functions.yaml generated successfully.");
} catch (err) {
  console.error("Failed to generate functions.yaml:", err.message);
  process.exit(1);
}
