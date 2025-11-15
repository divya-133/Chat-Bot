// import express from "express";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";

// // ✅ Load .env before anything else
// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 3000;

// // ✅ ES module dirname setup
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// console.log("Running server from:", __dirname);


// // ✅ Serve static frontend files
// app.use(express.static(path.join(__dirname, "public")));
// app.use(express.json());

// // ✅ Serve main site
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

// // ✅ Serve agent dashboard
// app.get("/agent", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "agent.html"));
// });

// // ✅ EmailJS config endpoint
// app.get("/config", (req, res) => {
//   res.json({
//     EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID || "",
//     EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID || "",
//     EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY || "",
//   });
// });


// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
// });
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ES Module dirname FIX
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Running server from:", __dirname);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Main site
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Agent dashboard
app.get("/agent", (req, res) => {
  console.log("Serving:", path.join(__dirname, "public", "agent.html"));
  res.sendFile(path.join(__dirname, "public", "agent.html"));
});

// EmailJS config
app.get("/config", (req, res) => {
  res.json({
    EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID || "",
    EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID || "",
    EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY || "",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

