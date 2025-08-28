const express = require("express");
const { saveRawJSON } = require("../../../utils/files");
const hmacVerify = require("../../../middleware/hmacVerify");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "";
const ALLOW_UNVERIFIED = process.env.ALLOW_UNVERIFIED === "1";
const SAVE_PAYLOADS = process.env.SAVE_PAYLOADS === "1";

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secret: SECRET, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/paid, 所以这里就是 POST "/"
router.post("/", (req, res) => {
    const headers = req.headers;
    const raw = req.body;              // Buffer
    const rawText = raw.toString("utf8");
    const topic = req.get("X-Shopify-Topic");

    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    // 可选：健壮性提示 (测试负载有时不匹配主题)
    if (topic && topic !== "orders/paid") {
        console.warn(`[提示] 该请求的 X-Shopify-Topic=${topic}, 但你挂的是 /orders/paid。`);
    }

    // 打印头 + 原文 (仅 stdout, 不落盘)
    console.log("=== HEADERS START ===");
    console.dir(headers, { depth: null, maxArrayLength: null });
    console.log("=== HEADERS END ===");

    console.log("=== RAW BODY START ===");
    console.log(rawText);
    console.log("=== RAW BODY END ===");

    // 解析 & (可选)落盘
    try {
        const order = JSON.parse(rawText);
        console.log("=== FULL ORDER OBJECT START ===");
        console.dir(order, { depth: null, maxArrayLength: null });
        console.log("=== FULL ORDER OBJECT END ===");

        if (SAVE_PAYLOADS) {
            const saved = saveRawJSON(`order_${order.id || Date.now()}_paid.json`, rawText);
            console.log(`✔ 已保存完整订单到 ${saved}`);
        } else {
            console.log(" (未保存原始负载, 设置 SAVE_PAYLOADS=1 可开启落盘)");
        }
    } catch (e) {
        console.error("JSON parse failed (但已打印 RAW BODY):", e);
        if (SAVE_PAYLOADS) {
            const saved = saveRawJSON(`order_${Date.now()}_paid_raw.json`, rawText);
            console.log(`✔ 已保存原始负载到 ${saved}`);
        }
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
