const crypto = require("crypto");

/**
 * @param {{ secret?: string, allowUnverified?: boolean }} opts
 *  - secret: SHOPIFY_WEBHOOK_SECRET
 *  - allowUnverified: 开发调试时可允许签名不通过仍放行
 */
module.exports = function hmacVerify({ secret, allowUnverified = false } = {}) {
    function safeEq(a, b) {
        const A = Buffer.from(a || "", "utf8");
        const B = Buffer.from(b || "", "utf8");
        return A.length === B.length && crypto.timingSafeEqual(A, B);
    }

    return function (req, res, next) {
        const sigHeader = req.get("X-Shopify-Hmac-SHA256") || "";
        const raw = req.body; // Buffer (要求上游使用 express.raw)

        if (!secret) {
            console.warn("⚠️  SHOPIFY_WEBHOOK_SECRET 未设置——跳过验签, 仅用于开发环境。");
            return next();
        }

        const computed = crypto.createHmac("sha256", secret).update(raw).digest("base64");
        if (!safeEq(computed, sigHeader)) {
            console.error("✖ HMAC 验签失败。computed =", computed, "header =", sigHeader);
            if (!allowUnverified) return res.status(401).send("Invalid HMAC");
        }
        next();
    };
};
