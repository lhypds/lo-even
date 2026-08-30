const fs = require("fs");
const path = require("path");

function readEnv() {
  try {
    return fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  } catch {
    return "";
  }
}

function getEnvVar(key, fallback) {
  const match = readEnv().match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : fallback;
}

const PORT = getEnvVar("PORT", "4173");
const PM2_NAME = getEnvVar("PM2_NAME", "lo-even");

module.exports = {
  apps: [
    {
      name: PM2_NAME,
      script: "node_modules/vite/bin/vite.js",
      args: `preview --host 0.0.0.0 --port ${PORT} --strictPort --clearScreen false`,
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: { NODE_ENV: "production" },
      time: true,
      out_file: `logs/${PM2_NAME}.out.log`,
      error_file: `logs/${PM2_NAME}.err.log`,
      merge_logs: true,
    },
  ],
};
