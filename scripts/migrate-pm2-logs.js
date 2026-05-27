const fs = require("fs");
const os = require("os");
const path = require("path");

const appName = "OPPONZ-TTS-Webhooks";
const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), ".pm2");
const sourceDir = path.join(pm2Home, "logs");
const targetRoot = path.join(__dirname, "..", "logs");

const targets = [
    {
        prefix: `${appName}-error`,
        dir: path.join(targetRoot, "errors")
    },
    {
        prefix: `${appName}-out`,
        dir: path.join(targetRoot, "out")
    }
];

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function uniqueTarget(filePath) {
    if (!fs.existsSync(filePath)) return filePath;

    const parsed = path.parse(filePath);
    let count = 1;
    let candidate = path.join(parsed.dir, `${parsed.name}_migrated-${count}${parsed.ext}`);
    while (fs.existsSync(candidate)) {
        count += 1;
        candidate = path.join(parsed.dir, `${parsed.name}_migrated-${count}${parsed.ext}`);
    }
    return candidate;
}

function moveFile(source, target) {
    try {
        fs.renameSync(source, target);
    } catch (err) {
        if (err.code !== "EXDEV") throw err;
        fs.copyFileSync(source, target);
        fs.unlinkSync(source);
    }
}

if (!fs.existsSync(sourceDir)) {
    console.log(`PM2 logs directory not found: ${sourceDir}`);
    process.exit(0);
}

for (const target of targets) ensureDir(target.dir);

const files = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

let moved = 0;

for (const fileName of files) {
    const target = targets.find((item) => fileName.startsWith(item.prefix));
    if (!target) continue;

    const source = path.join(sourceDir, fileName);
    const destination = uniqueTarget(path.join(target.dir, fileName));
    moveFile(source, destination);
    moved += 1;

    console.log(`Moved ${source} -> ${destination}`);
}

console.log(`Done. Moved ${moved} PM2 log file(s).`);
