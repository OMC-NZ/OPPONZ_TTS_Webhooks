const path = require("path");

const logsRoot = path.join(__dirname, "logs");

module.exports = {
    apps: [
        {
            name: "OPPONZ-TTS-Webhooks",
            script: path.join(__dirname, "src", "index.js"),
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            merge_logs: true,
            error_file: path.join(logsRoot, "errors", "OPPONZ-TTS-Webhooks-error.log"),
            out_file: path.join(logsRoot, "out", "OPPONZ-TTS-Webhooks-out.log"),
            log_date_format: "YYYY-MM-DD HH:mm:ss Z"
        }
    ]
};
