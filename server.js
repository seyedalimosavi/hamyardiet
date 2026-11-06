// server.js — Passenger / cPanel "Setup Node.js App" startup file.
// Point the application startup file to this file in the cPanel Node.js app UI.
// CommonJS on purpose: Passenger loads it directly with require().

const { createServer } = require("http");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
    // Do not log database contents or credentials here.
    console.log(`> NutriClinic ready on http://${hostname}:${port}`);
  });
});
