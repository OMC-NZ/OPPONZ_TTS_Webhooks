const express = require("express");
const hmacVerify = require("../../../middleware/hmacVerify");
const { saveRawJSON } = require("../../../utils/files");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const SECRET = process.env.OPPOSTORE_WEBHOOK_SECRET || "";
const flag = (k) => /^1|true|yes$/i.test((process.env[k] || "").trim());
const ALLOW_UNVERIFIED = flag("ALLOW_UNVERIFIED");
const SAVE_PAYLOADS = flag("SAVE_PAYLOADS");

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secret: SECRET, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/create, 所以这里就是 POST "/"
router.post("/", (req, res) => {           // Buffer
    const rawText = req.body.toString("utf8");
    const order = JSON.parse(rawText);
    const rawTopic = req.get("X-Shopify-Topic") || "";
    const EXPECTED_TOPIC = "orders/create";

    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    // 可选：健壮性提示 (测试负载有时不匹配主题)
    if (rawTopic && rawTopic !== EXPECTED_TOPIC) {
        console.warn(`[提示] 该请求的 X-Shopify-Topic=${rawTopic}, 但你挂的是 /${EXPECTED_TOPIC}。`);
    }

    // 解析 & (可选)落盘
    try {
        if (order.tags === "trademe") {
            if (SAVE_PAYLOADS) {
                const saved = saveRawJSON(`trademe_${order.order_number}.json`, rawText);
                console.log(`[${ts}] - ✔ 已保存原始负载到 ${saved}`);
            }
        }
    } catch (e) {
        console.error("JSON parse failed:", e);
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
