// 在 Shopify 中成功支付的订单来到这里。
const express = require("express");
require("dotenv").config();
const { saveRawJSON } = require("../../../utils/files");
const hmacVerify = require("../../../middleware/hmacVerify");
const caveCreateOrder = require("../../../ceva/createOrder");
const { ceva_oos } = require("../../../mailContent/ceva_oos");
const { getNZLogTime } = require("../../../utils/timeUtils");
const { sendMail } = require("../../../utils/sendMail");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";

const TTS_SECRET = process.env.TTS_WEBHOOK_SECRET || "";
const MYFIRST_SECRET = process.env.MYFIRST_WEBHOOK_SECRET || "";
const WEBHOOK_SECRETS = [TTS_SECRET, MYFIRST_SECRET].filter(Boolean);

const ALLOW_UNVERIFIED = /^(1|true|yes)$/i.test((process.env.ALLOW_UNVERIFIED || "").trim());

if (WEBHOOK_SECRETS.length === 0 && !ALLOW_UNVERIFIED) {
    console.warn(`[${getNZLogTime()}] ⚠️ WARNING: No webhook secrets are set! Incoming webhooks will be rejected unless ALLOW_UNVERIFIED=1.`);
}

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secrets: WEBHOOK_SECRETS, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/paid, 所以这里就是 POST "/"
router.post("/", async (req, res) => {
    const ts = new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", hour12: false }).replace(/[:/,\s]/g, "-");

    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    console.log(`[${ts}] webhook received: ${req.originalUrl}`);

    let rawText;

    try {
        if (!Buffer.isBuffer(req.body)) {
            console.error(`[${ts}] req.body is not Buffer. type=${typeof req.body}`);
            return;
        }

        rawText = req.body.toString("utf8");
    } catch (e) {
        console.error(`[${ts}] failed to read raw body:`, e);
        return;
    }

    // 校验 Shopify webhook 的 topic 是否与当前路由匹配。
    // 正常情况下，/webhooks/orders/paid 应该只收到 orders/paid。
    // 如果 topic 不匹配，说明 Shopify 配置、测试 payload 或路由挂载可能有问题。
    const topic = req.get("X-Shopify-Topic");
    if (topic && topic !== "orders/paid") {
        console.warn(`[${ts}] [提示] X-Shopify-Topic=${topic}, 但路由为 /orders/paid`);
    }

    const shopDomain = req.get("X-Shopify-Shop-Domain");
    const shopName = shopDomain.replace(".myshopify.com", "");
    const shopShortNameMap = {
        "thetechnologystorenz": {
            name: "TTS",
            billTo: "2086822",
            shipTo: "2086823"
        },
        "myfirst-nz": {
            name: "MF",
            billTo: "2087400",
            shipTo: "2087401"
        },
    };
    const shopShort = shopShortNameMap[shopName];

    if (!shopShort) {
        console.error(`[${ts}] 未识别的 Shopify 店铺: ${shopName}`);
        return;
    }

    let order;

    try {
        order = JSON.parse(rawText);
    } catch (e) {
        console.error(`[${ts}] JSON parse failed:`, e);
        const saved = saveRawJSON(`orderError_${Date.now()}.json`, rawText);
        if (saved) console.log(`✔ 已保存原始负载到 ${saved}`);
        return;
    }

    try {
        const data = await caveCreateOrder(shopShort, order);
        const type = data?.errorWarnings?.[0]?.errorType;

        if (type === "API_Warning") {
            console.log(`[${ts}] API_Warning: ${JSON.stringify(data, null, 2)}`);
            return;
        }

        if (type === "API_Err") {
            console.error(`[${ts}] API_Err: ${JSON.stringify(data, null, 2)}`);

            ceva_oos(data)
                .then(() => console.log(`[${ts}] ceva_oos email sent`))
                .catch((err) => console.error(`[${ts}] ceva_oos error:`, err));

            return;
        }

        const fileName = `内部失败_${data?.orderID || order?.order_number || "noOrderId"}_${ts}.json`;
        const saved = saveRawJSON(fileName, JSON.stringify(data, null, 2));
        if (saved) console.log(`✔ 已保存到 ${saved}`);
    } catch (e) {
        console.error(`[${ts}] ${order.name} createOrder `, e);
        const sendMail = await sendMail({ to: process.env.DEVE_EMAIL, subject: 'Order Creation Failed', html: e, key: 'ONLINEKONEC' });

        const saved = saveRawJSON(`createOrderError_${order?.order_number || "unknown"}_${ts}.json`, rawText);
        if (saved) console.log(`已保存原始负载到 .pm2/logs/TTS-Webhooks-error.log`);
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
