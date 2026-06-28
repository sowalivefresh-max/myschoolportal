/**
 * api.js
 * Centralized API client for communicating with the Google Apps Script Backend.
 */

// ─── DEPLOYMENT CONFIGURATION ────────────────────────────────────────────────
// Replace the URL below with your own Google Apps Script Web App deployment URL.
// You get this URL from: Apps Script → Deploy → Manage deployments → Web App URL
// ─────────────────────────────────────────────────────────────────────────────
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxUpl9LK6tonzOHTPCVnc1NmeGHoWH7cyJyy_dV1PyaWStacVnhS3HMe0SJo_L1cNxg/exec";

/**
 * Calls a backend function.
 * @param {string} action - The name of the function in Code.gs
 * @param {Array} args - An array of arguments to pass to the function
 * @returns {Promise<any>}
 */
async function runBackendAction(action, args = []) {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: action, args: args }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8" // Important: text/plain prevents CORS preflight issues with Apps Script
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
