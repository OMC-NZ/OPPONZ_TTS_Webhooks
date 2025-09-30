const fs = require("fs");
const path = require("path");

const SAVE_ENABLED = /^1|true|yes$/i.test((process.env.SAVE_PAYLOADS || "").trim());

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function saveRawJSON(fileName, rawText, opts = {}) {
    const force = !!opts.force;
    if (!force && !SAVE_ENABLED) return null; // 直接不写、不建目录

    const day = new Date().toLocaleDateString("en-NZ", {
        timeZone: "Pacific/Auckland",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).split("/").reverse().join("-");
    const logsRoot = path.join(process.cwd(), "logs", day);
    ensureDir(logsRoot);

    const safeName = String(fileName).replace(/[^\w\-.:]+/g, "_");
    let full = path.join(logsRoot, safeName);
    try { fs.writeFileSync(full, rawText, { flag: "wx" }); }
    catch (err) {
        if (err.code !== "EEXIST") throw err;
        const p = path.parse(full);
        full = path.join(p.dir, `${p.name}-${Math.random().toString(36).slice(2, 8)}${p.ext}`);
        fs.writeFileSync(full, rawText, { flag: "wx" });
    }
    return path.relative(process.cwd(), full);
}

module.exports = { saveRawJSON };
