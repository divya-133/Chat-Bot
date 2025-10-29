// ------------------------------
// Secure Express Server
// ------------------------------
require("dotenv").config({ path: ".env.local" });
const express = require("express");
const path = require("path");
const app = express();

// Serve static files from "public"
app.use(express.static(path.join(__dirname, "public")));

// API endpoint for frontend config
app.get("/config", (req, res) => {
  res.json({
    EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY,
    EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID
  });
});

// Serve main index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
