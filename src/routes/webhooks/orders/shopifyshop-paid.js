const express = require("express");
const { saveRawJSON } = require("../../../utils/files");
const hmacVerify = require("../../../middleware/hmacVerify");
const createOrder = require("../../../ceva/createOrder");
const { ceva_oos } = require("../../../mailContent/ceva_oos");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const SECRET = process.env.TTS_WEBHOOK_SECRET || "";
const flag = (k) => /^1|true|yes$/i.test((process.env[k] || "").trim());
const ALLOW_UNVERIFIED = flag("ALLOW_UNVERIFIED");
const SAVE_PAYLOADS = flag("SAVE_PAYLOADS");
console.log(`[flags] SAVE_PAYLOADS=${SAVE_PAYLOADS}, ALLOW_UNVERIFIED=${ALLOW_UNVERIFIED}`);
if (!SECRET && !ALLOW_UNVERIFIED) {
    console.warn("⚠️ WARNING: TTS_WEBHOOK_SECRET is not set! All incoming webhooks will be rejected unless ALLOW_UNVERIFIED=1 is set.");
}

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secret: SECRET, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/shopifyshop-paid, 所以这里就是 POST "/"
router.post("/", async (req, res) => {
    const rawText = req.body.toString("utf8");
    const order = JSON.parse(rawText);
    const rawTopic = req.get("X-Shopify-Topic") || "";
    const EXPECTED_TOPIC = "orders/shopifyshop-paid";
    const ts = new Date().toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
        hour12: false,
    }).replace(/[:/,\s]/g, "-");

    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    // 可选：健壮性提示 (测试负载有时不匹配主题)
    if (rawTopic && rawTopic !== EXPECTED_TOPIC) {
        console.warn(`[提示] 该请求的 X-Shopify-Topic=${rawTopic}, 但你挂的是 /${EXPECTED_TOPIC}。`);
    }

    // 解析 & (可选)落盘
    try {
        console.log("=== FULL ORDER OBJECT START ===");
        // console.dir(order, { depth: null, maxArrayLength: null });
        const data = await createOrder(order);
        if (data.errorWarnings[0].errorType === "API_Warning") {
            console.log(`[${ts}] - API_Warning内部成功打印: ${JSON.stringify(data, null, 2)}`);
        } else if (data.errorWarnings[0].errorType === "API_Err") {
            // ceva_oos和保存成文件二选一即可
            ceva_oos(data).catch((err) => console.error("ceva_oos error:", err));

            // if (SAVE_PAYLOADS) {
            //     const fileName = `API_Err_${data.orderID || "noOrderId"}_${ts}.json`;
            //     const saved = saveRawJSON(fileName, JSON.stringify(data, null, 2));
            //     if (saved) console.log(`✔ 已保存到 ${saved}`);
            // } else {
            //     console.log("（未保存原始负载，设置 SAVE_PAYLOADS=1 可开启落盘）");
            // }
        } else {
            if (SAVE_PAYLOADS) {
                const fileName = `内部失败_${JSON.stringify(data, null, 2).orderID || "noOrderId"}_${ts}.json`;
                const saved = saveRawJSON(fileName, JSON.stringify(data, null, 2));
                if (saved) console.log(`✔ 已保存到 ${saved}`);
            } else {
                console.log("（未保存原始负载，设置 SAVE_PAYLOADS=1 可开启落盘）");
            }
        }
        console.log("=== FULL ORDER OBJECT END ===");
    } catch (e) {
        console.error("JSON parse failed (但已打印 RAW BODY):", e);
        if (SAVE_PAYLOADS) {
            const saved = saveRawJSON(`orderError_${order.order_number}.json`, rawText);
            console.log(`✔ 已保存原始负载到 ${saved}`);
        }
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
