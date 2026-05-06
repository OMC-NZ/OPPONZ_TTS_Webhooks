// 订单被创建于第三方网店(如 trademe)，这类订单被创建时是已支付的状态，
// 所以它不会被 shopify 的 “Order Paid” 事件捕获，
// 因此只能通过 “Order Created” 事件来捕捉这类订单。
const express = require("express");
require("dotenv").config();
const hmacVerify = require("../../../middleware/hmacVerify");
const { saveRawJSON } = require("../../../utils/files");
const caveCreateOrder = require("../../../ceva/createOrder");
const { ceva_oos } = require("../../../mailContent/ceva_oos");
const { sendMail } = require("../../../utils/sendMail");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";
const TTS_SECRET = process.env.TTS_WEBHOOK_SECRET || "";
const WEBHOOK_SECRETS = [TTS_SECRET].filter(Boolean);
const ALLOW_UNVERIFIED = /^(1|true|yes)$/i.test((process.env.ALLOW_UNVERIFIED || "").trim());

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secrets: WEBHOOK_SECRETS, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/create, 所以这里就是 POST "/"
router.post("/", async (req, res) => {           // Buffer
    const ts = new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", hour12: false }).replace(/[:/,\s]/g, "-");

    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");

    console.log(`[${ts}] webhook received: ${req.originalUrl}`);

    let rawText;

    try {
        if (!Buffer.isBuffer(req.body)) {
            console.error(`[${ts}] req.body is not Buffer. type=${typeof req.body}`);

            try {
                await sendMail({
                    to: process.env.DEVE_EMAIL,
                    subject: `[Webhook] Invalid Body Type for Third-Party Payment Order`,
                    text: `Error Logs was saved at '/home/nzdev/.pm2/logs/OPPONZ-TTS-Webhooks-error'.`,
                    key: 'ONLINEKONEC'
                });
            } catch (mailErr) {
                console.error(`[${ts}] Failed to send error notification email:`, mailErr);
            }

            return;
        }

        rawText = req.body.toString("utf8");
    } catch (e) {
        console.error(`[${ts}] failed to read raw body:`, e);

        try {
            await sendMail({
                to: process.env.DEVE_EMAIL,
                subject: `[Webhook] Failed to Read Raw Body for Third-Party Payment Order`,
                text: `Error Logs was saved at '/home/nzdev/.pm2/logs/OPPONZ-TTS-Webhooks-error'.`,
                key: 'ONLINEKONEC'
            });
        } catch (mailErr) {
            console.error(`[${ts}] Failed to send error notification email:`, mailErr);
        };

        return;
    }

    // 可选：健壮性提示
    const topic = req.get("X-Shopify-Topic");
    if (topic && topic !== "orders/create") {
        console.warn(`[${ts}] [提示] X-Shopify-Topic=${topic}, 但路由为 /orders/create`);
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

        try {
            await sendMail({
                to: process.env.DEVE_EMAIL,
                subject: `[Webhook] Unrecognized Shopify Store: ${shopName}`,
                text: `Error Logs was saved at '/home/nzdev/.pm2/logs/OPPONZ-TTS-Webhooks-error'.`,
                key: 'ONLINEKONEC'
            });
        } catch (mailErr) {
            console.error(`[${ts}] Failed to send error notification email:`, mailErr);
        }

        return;
    }

    let order;

    try {
        order = JSON.parse(rawText);
        // tags 可能是字符串或数组，统一转小写字符串后匹配
        const tagsText = Array.isArray(order.tags) ? order.tags.join(",") : String(order.tags || "");

        if (/\btrademe\b/i.test(tagsText)) {
            console.log("触发 trademe 订单处理逻辑");
            const data = await caveCreateOrder(shopShort, order);
            const type = data?.errorWarnings?.[0]?.errorType;

            if (type === "API_Warning") {
                console.log(`[${ts}] API_Warning: ${JSON.stringify(data, null, 2)}`);
                return;
            }

            if (type === "API_Err") {
                console.error(`[${ts}] API_Err: ${JSON.stringify(data, null, 2)}`);

                ceva_oos(data)
                    .then(() => {
                        console.log(`[${ts}] ceva_oos email sent`)
                    }).catch((err) => {
                        console.error(`[${ts}] ceva_oos error:`, err)
                    });

                return;
            }

            const fileName = `内部失败_trademe_${data?.orderID || order?.order_number || "noOrderId"}_${ts}.json`;
            const saved = saveRawJSON(fileName, JSON.stringify(data, null, 2), { force: true });
            if (saved) console.log(`✔ 已保存到 ${saved}`);
        } else {
            console.log("非 trademe 订单，跳过处理");
            return;
        }
    } catch (e) {
        console.error(`[${ts}] ${order.name} createOrder `, e);

        try {
            await sendMail({
                to: process.env.DEVE_EMAIL,
                subject: 'Order Creation Failed',
                html: e,
                key: 'ONLINEKONEC'
            });
        } catch (mailErr) {
            console.error(`[${ts}] Failed to send error notification email:`, mailErr);
        }

        const saved = saveRawJSON(`trademe_${order?.order_number || "unknown"}_${ts}.json`, rawText, { force: true });
        if (saved) console.log(`✔ 已保存原始负载到 ${saved}`);
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
