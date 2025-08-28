const fs = require("fs");
const path = require("path");

/**
 * 自动把 src/routes 下所有 .js 文件作为 Router 挂到 "/" + 相对路径
 * 例：
 *   routes/webhooks/orders/create.js  ->  /webhooks/orders/create
 *   routes/health/index.js            ->  /health
 */
module.exports = function mountAllRoutes(app, options = {}) {
    const rootDir = options.rootDir || path.join(__dirname); // .../src/routes
    const files = listRouteFiles(rootDir);

    files.forEach((absFile) => {
        const rel = path.relative(rootDir, absFile); // e.g. 'webhooks/orders/create.js'
        if (path.basename(rel).startsWith("_")) return; // 忽略以 _ 开头的文件
        let noExt = rel.replace(/\.js$/i, "");          // 'webhooks/orders/create'
        noExt = noExt.replace(/\\/g, "/");              // 兼容 Windows
        noExt = noExt.replace(/\/index$/i, "");         // index.js -> 目录本身
        const mountPath = `/${noExt || ""}`;            // '/' or '/webhooks/orders/create'

        const router = require(absFile);
        if (!router || typeof router !== "function" || !router.stack) {
            console.warn(`⚠️  routes/${rel} 未导出 express.Router, 已跳过`);
            return;
        }

        app.use(mountPath, router);
        console.log(`✅ Mounted: ${mountPath}  <= routes/${rel}`);
    });
};

function listRouteFiles(dir) {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) out.push(...listRouteFiles(p));
        else if (stat.isFile() && /\.js$/i.test(name)) out.push(p);
    }
    return out;
}
