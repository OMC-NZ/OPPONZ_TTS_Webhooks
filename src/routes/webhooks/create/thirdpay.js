// 订单被创建且未支付, 其支付方式选择了第三方支付（如 Gilrose）
const express = require("express");
require("dotenv").config();
const hmacVerify = require("../../../middleware/hmacVerify");
const createOrder = require("../../../gilrose/createOrder");
const { gilroselimitprice } = require("../../../mailContent/gilroselimitprice");
const { sendMail } = require("../../../utils/sendMail");
const { getNZLogTime } = require("../../../utils/timeUtils");

const router = express.Router();
const RAW_LIMIT = process.env.WEBHOOK_RAW_LIMIT || "5mb";

const OPPOSTORE_SECRET = process.env.OPPOSTORE_WEBHOOK_SECRET || "";
const WEBHOOK_SECRETS = [OPPOSTORE_SECRET].filter(Boolean);

const ALLOW_UNVERIFIED = /^(1|true|yes)$/i.test((process.env.ALLOW_UNVERIFIED || "").trim());

// 仅此路由树使用 raw (必须在任何 json() 之前)
router.use(express.raw({ type: "application/json", limit: RAW_LIMIT }));

// HMAC 验签 (基于原始字节)
router.use(hmacVerify({ secrets: WEBHOOK_SECRETS, allowUnverified: ALLOW_UNVERIFIED }));

// 由于自动挂载：此文件映射到 /webhooks/orders/create, 所以这里就是 POST "/"
router.post("/", async (req, res) => {  // Buffer format
    // 先 ACK, 避免 Shopify 重试
    res.status(200).send("OK");
    console.log("[Webhook] 收到请求");

    const rawText = req.body.toString("utf8");

    // 可选：健壮性提示 (测试负载有时不匹配主题)
    const topic = req.get("X-Shopify-Topic");
    if (topic && topic !== "orders/create") {
        console.warn(`[${getNZLogTime()}] [提示] X-Shopify-Topic=${topic}, 但路由为 /orders/create`);
    }

    let order;
    try {
        order = JSON.parse(rawText);
        console.log("[Webhook] 订单解析成功", {
            orderName: order?.name,
            total_price: order?.total_price
        });
    } catch (e) {
        console.error(`[${getNZLogTime()}] JSON parse failed:`, e);
        return;
    }

    // 正则表达式去检索是否包含匹配关键词，而不是完全匹配。
    const hasGilrose = Array.isArray(order.payment_gateway_names) && order.payment_gateway_names.some((s) => /gilrose/i.test(String(s)));
    if (!hasGilrose) return;

    const LIMIT_AMOUNT = 499;

    try {
        if (Number(order.total_price) >= LIMIT_AMOUNT) {
            const result = await createOrder(order);
            if (!result.success) {
                console.warn("[createOrder 失败]", {
                    time: getNZLogTime(),
                    orderName: order.name,
                    code: result.code,
                    message: result.message
                });

                const subject = result.code === "CUSTOMER_INFO_LOST"
                    ? `[WARNING] OPPO Gilrose Order ${order.name} Error — Customer Info Incomplete`
                    : `[WARNING] OPPO Gilrose Order ${order.name} Error — Request Failed`;

                const html = `
                    <p>Hi there,</p>
                    <p>Order No.: ${order.name}</p>
                    <p>Code: ${result.code}</p>
                    <p>Message: ${result.message}</p>
                    <br />
                    <p>Kind regards,</p>
                    <p>OPPO NZ Online Shop</p>
                `;

                try {
                    await sendMail({ to: process.env.DEVE_EMAIL, subject, html, key: "ONLINEOPPO" });
                } catch (mailError) {
                    console.error("[sendMail 失败]", {
                        time: getNZLogTime(),
                        orderName: order?.name,
                        message: mailError?.message,
                        stack: mailError?.stack
                    });
                }
                return;
            }
            console.log("[createOrder 成功]", result.data);
        } else {
            const limitPriceResult = await gilroselimitprice(order);
            console.log("[GilroseLimit]", limitPriceResult);
        }
    } catch (e) {
        console.error("处理订单失败:", {
            time: getNZLogTime(),
            orderName: order?.name,
            message: e?.message,
            stack: e?.stack
        });
    }
});

// 未知子路径兜底 (可选)
router.all(/.*/, (_req, res) => {
    res.status(404).send('Unknown webhook route');
});

module.exports = router;
