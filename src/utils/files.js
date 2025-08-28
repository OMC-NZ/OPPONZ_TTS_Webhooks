const fs = require("fs");
const path = require("path");

function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function saveRawJSON(fileName, rawText) {
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logsRoot = path.join(process.cwd(), "logs", day); // 用 cwd，避免工作目录不一致
    ensureDir(logsRoot);

    const safeName = String(fileName).replace(/[^\w\-.:]+/g, "_");
    let full = path.join(logsRoot, safeName);

    // 使用 wx：若存在则报错，避免覆盖
    try {
        fs.writeFileSync(full, rawText, { flag: "wx" });
    } catch (err) {
        if (err.code !== "EEXIST") throw err;
        // 极小概率同名：加随机后缀
        const parsed = path.parse(full);
        full = path.join(parsed.dir, `${parsed.name}-${Math.random().toString(36).slice(2, 8)}${parsed.ext}`);
        fs.writeFileSync(full, rawText, { flag: "wx" });
    }
    // 返回相对仓库根的路径并打印绝对路径，方便排查
    const rel = path.relative(process.cwd(), full);
    console.log(`[saveRawJSON] wrote: ${full}`);
    return rel;
}

module.exports = { saveRawJSON };
