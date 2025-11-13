const express = require("express");
const { saveRawJSON } = require("../../../utils/files");
const hmacVerify = require("../../../middleware/hmacVerify");
const createOrder = require("../../../ceva/createOrder");
const { ceva_oos } = require("../../../mailContent/ceva_oos");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const SECRET = process.env.TTS_WEBHOOK_SECRET || "";
const ALLOW_UNVERIFIED = /^(1|true|yes)$/i.test((process.env.ALLOW_UNVERIFIED || "").trim());
if (!SECRET && !ALLOW_UNVERIFIED) {
    console.warn("⚠️ WARNING: TTS_WEBHOOK_SECRET is not set! Incoming webhooks will be rejected unless ALLOW_UNVERIFIED=1.");
}

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secret: SECRET, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/paid, 所以这里就是 POST "/"
router.post("/", async (req, res) => {
    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    const rawText = req.body.toString("utf8");
    const ts = new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", hour12: false }).replace(/[:/,\s]/g, "-");

    // 可选：健壮性提示 (测试负载有时不匹配主题)
    const topic = req.get("X-Shopify-Topic");
    if (topic && topic !== "orders/paid") {
        console.warn(`[提示] X-Shopify-Topic=${topic}, 但路由为 /orders/paid`);
    }

    let order;
    try {
        order = JSON.parse(rawText);
    } catch (e) {
        console.error("JSON parse failed:", e);
        const saved = saveRawJSON(`orderError_${Date.now()}.json`, rawText);
        if (saved) console.log(`✔ 已保存原始负载到 ${saved}`);
        return;
    }

    try {
        const data = await createOrder(order);
        const type = data?.errorWarnings?.[0]?.errorType;

        if (type === "API_Warning") {
            console.log(`[${ts}] API_Warning: ${JSON.stringify(data, null, 2)}`);
            return;
        }

        if (type === "API_Err") {
            ceva_oos(data).catch((err) => console.error("ceva_oos error:", err));
            return;
        }

        const fileName = `内部失败_${data?.orderID || order?.order_number || "noOrderId"}_${ts}.json`;
        const saved = saveRawJSON(fileName, JSON.stringify(data, null, 2));
        if (saved) console.log(`✔ 已保存到 ${saved}`);
    } catch (e) {
        console.error("createOrder 失败:", e);
        const saved = saveRawJSON(`createOrderError_${order?.order_number || "unknown"}_${ts}.json`, rawText);
        if (saved) console.log(`✔ 已保存原始负载到 ${saved}`);
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
