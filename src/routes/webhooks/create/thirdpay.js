const express = require("express");
const hmacVerify = require("../../../middleware/hmacVerify");
const createOrder = require("../../../gilrose/createOrder");
const { gilroselimitprice } = require("../../../mailContent/gilroselimitprice");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const SECRET = process.env.OPPOSTORE_WEBHOOK_SECRET || "";
const flag = (k) => /^1|true|yes$/i.test((process.env[k] || "").trim());
const ALLOW_UNVERIFIED = flag("ALLOW_UNVERIFIED");

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secret: SECRET, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/create, 所以这里就是 POST "/"
router.post("/", async (req, res) => {  // Buffer format
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
        // 正则表达式去检索是否包含匹配关键词，而不是完全匹配。
        const hasGilrose = Array.isArray(order.payment_gateway_names) && order.payment_gateway_names.some(s => /gilrose/i.test(String(s)));
        if (!hasGilrose) return;

        const LIMIT_CENTS = 499;

        if (order.total_price >= LIMIT_CENTS) {
            const result = await createOrder(order);
            console.log('[createOrder]', result);
            return result
        } else {
            const limitPriceResult = await gilroselimitprice(order);
            console.log('[GilroseLimit]', limitPriceResult);
            return limitPriceResult;
        }
    } catch (e) {
        console.error("JSON parse failed:", e);
        throw e;
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
