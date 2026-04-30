const crypto = require("crypto");
const { getNZLogTime } = require("../utils/timeUtils");

/**
 * @param {{
 *   secret?: string,
 *   secrets?: string[],
 *   allowUnverified?: boolean
 * }} opts
 *
 * - secret: 单个 WEBHOOK_SECRET
 * - secrets: 多个 WEBHOOK_SECRET
 * - allowUnverified: 开发调试时可允许签名不通过仍放行
 */
module.exports = function hmacVerify({ secret, secrets, allowUnverified = false } = {}) {
    const secretList = Array.isArray(secrets)
        ? secrets.filter(Boolean)
        : [secret].filter(Boolean);

    function safeEq(a, b) {
        const A = Buffer.from(a || "", "utf8");
        const B = Buffer.from(b || "", "utf8");

        return A.length === B.length && crypto.timingSafeEqual(A, B);
    }

    return function (req, res, next) {
        const sigHeader = req.get("X-Shopify-Hmac-SHA256") || "";
        const raw = req.body; // Buffer，要求上游使用 express.raw

        if (!Buffer.isBuffer(raw)) {
            console.error(`[${getNZLogTime()}] ✖ HMAC 验签失败: req.body 不是 Buffer`);
            return res.status(400).send("Raw body required");
        }

        if (secretList.length === 0) {
            console.warn(`[${getNZLogTime()}] WEBHOOK_SECRET 未设置。`);

            if (allowUnverified) {
                console.warn(`[${getNZLogTime()}] ALLOW_UNVERIFIED 已开启，跳过验签。`);
                return next();
            }

            return res.status(500).send("Webhook secret not configured");
        }

        const matched = secretList.some((s) => {
            const computed = crypto
                .createHmac("sha256", s)
                .update(raw)
                .digest("base64");

            return safeEq(computed, sigHeader);
        });

        if (!matched) {
            console.error(`[${getNZLogTime()}] ✖ HMAC 验签失败。header =`, sigHeader);

            if (!allowUnverified) {
                return res.status(401).send("Invalid HMAC");
            }

            console.warn(`[${getNZLogTime()}] ALLOW_UNVERIFIED 已开启，虽然验签失败但继续放行。`);
        }

        next();
    };
};