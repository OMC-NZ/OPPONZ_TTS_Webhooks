const fs = require("fs");
const path = require("path");

function ensureLogsDir() {
    const logsDir = path.join(__dirname, "..", "..", "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    return logsDir;
}

function saveRawJSON(basename, rawText) {
    const logsDir = ensureLogsDir();
    const file = path.join(logsDir, basename);
    fs.writeFileSync(file, rawText);
    return `logs/${basename}`;
}

module.exports = { ensureLogsDir, saveRawJSON };
