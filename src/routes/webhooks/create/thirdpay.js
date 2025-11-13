const express = require("express");
const hmacVerify = require("../../../middleware/hmacVerify");
const createOrder = require("../../../gilrose/createOrder");
const { gilroselimitprice } = require("../../../mailContent/gilroselimitprice");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const SECRET = process.env.OPPOSTORE_WEBHOOK_SECRET || "";
const ALLOW_UNVERIFIED = /^(1|true|yes)$/i.test((process.env.ALLOW_UNVERIFIED || "").trim());

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secret: SECRET, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/create, 所以这里就是 POST "/"
router.post("/", async (req, res) => {  // Buffer format
    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    const rawText = req.body.toString("utf8");

    // 可选：健壮性提示 (测试负载有时不匹配主题)
    const topic = req.get("X-Shopify-Topic");
    if (topic && topic !== "orders/create") {
        console.warn(`[提示] X-Shopify-Topic=${topic}, 但路由为 /orders/create`);
    }

    let order;
    try {
        order = JSON.parse(rawText);
    } catch (e) {
        console.error("JSON parse failed:", e);
        return;
    }

    // 正则表达式去检索是否包含匹配关键词，而不是完全匹配。
    const hasGilrose = Array.isArray(order.payment_gateway_names) && order.payment_gateway_names.some((s) => /gilrose/i.test(String(s)));
    if (!hasGilrose) return;

    const LIMIT_CENTS = 499;

    try {
        if (Number(order.total_price) >= LIMIT_CENTS) {
            const result = await createOrder(order);
            console.log("[createOrder]", result);
        } else {
            const limitPriceResult = await gilroselimitprice(order);
            console.log("[GilroseLimit]", limitPriceResult);
        }
    } catch (e) {
        console.error("处理订单失败:", e);
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
