const express = require("express");
const { saveRawJSON } = require("../../../utils/files");
const hmacVerify = require("../../../middleware/hmacVerify");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "";
const flag = (k) => /^1|true|yes$/i.test((process.env[k] || "").trim());
const ALLOW_UNVERIFIED = flag("ALLOW_UNVERIFIED");
const SAVE_PAYLOADS = flag("SAVE_PAYLOADS");
console.log(`[flags] SAVE_PAYLOADS=${SAVE_PAYLOADS}, ALLOW_UNVERIFIED=${ALLOW_UNVERIFIED}`);
if (!SECRET && !ALLOW_UNVERIFIED) {
    console.warn("⚠️ WARNING: SHOPIFY_WEBHOOK_SECRET is not set! All incoming webhooks will be rejected unless ALLOW_UNVERIFIED=1 is set.");
}

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secret: SECRET, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/paid, 所以这里就是 POST "/"
router.post("/", (req, res) => {
    const headers = req.headers;
    const raw = req.body;              // Buffer
    const rawText = raw.toString("utf8");
    const rawTopic = req.get("X-Shopify-Topic") || "";
    const EXPECTED_TOPIC = "orders/paid";
    const wid = req.get("X-Shopify-Webhook-Id") || "noWid";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    // 仅用于生成文件名
    const topicForFile = (rawTopic || "unknown").replace(/\//g, "_");

    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    // 可选：健壮性提示 (测试负载有时不匹配主题)
    if (rawTopic && rawTopic !== EXPECTED_TOPIC) {
        console.warn(`[提示] 该请求的 X-Shopify-Topic=${rawTopic}, 但你挂的是 /${EXPECTED_TOPIC}。`);
    }

    // 打印头 + 原文 (仅 stdout, 不落盘)
    // console.log("=== HEADERS START ===");
    // console.dir(headers, { depth: null, maxArrayLength: null });
    // console.log("=== HEADERS END ===");

    // console.log("=== RAW BODY START ===");
    // console.log(rawText);
    // console.log("=== RAW BODY END ===");

    // 解析 & (可选)落盘
    try {
        const order = JSON.parse(rawText);
        // console.log("=== FULL ORDER OBJECT START ===");
        // console.dir(order, { depth: null, maxArrayLength: null });
        // console.log("=== FULL ORDER OBJECT END ===");

        if (SAVE_PAYLOADS) {
            const fileName = `${topicForFile}_${order.id || "noOrderId"}_${wid}_${ts}.json`;
            const saved = saveRawJSON(fileName, rawText);
            if (saved) console.log(`✔ 已保存到 ${saved}`);
        } else {
            console.log("（未保存原始负载，设置 SAVE_PAYLOADS=1 可开启落盘）");
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
