const crypto = require('crypto');
const { setTimeout: sleep } = require("timers/promises");

async function fetchWithTimeout(url, options = {}, ms = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

async function postJSONWithRetries(url, body, headers = {}, {
    timeoutMs = 15000,
    retries = 2,
    baseDelayMs = 500,
    clientId,
    hmacKey,
} = {}) {
    let attempt = 0;
    let lastErr;

    while (attempt <= retries) {
        try {
            const timestamp = Date.now().toString();
            const idempotencyKey = crypto.randomUUID();

            const dataToSign = `${timestamp}${idempotencyKey}${JSON.stringify(body)}`;
            const signature = crypto.createHmac('sha256', hmacKey).update(dataToSign).digest('hex');
            const fullHeaders = {
                "Content-Type": "application/json",
                "X-Client-Id": clientId,
                "X-Timestamp": timestamp,
                "Idempotency-Key": idempotencyKey,
                "X-Signature": signature,
                ...headers,
            };

            const res = await fetchWithTimeout(url, {
                method: "POST",
                headers: fullHeaders,
                body: JSON.stringify(body),
            }, timeoutMs);

            if (res.ok) return res;

            // 这些状态码可以重试
            if ([408, 429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                await sleep(delay);
                attempt++;
                continue;
            }

            const text = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
        } catch (err) {
            lastErr = err;
            // 网络/超时错误 → 重试
            const transient = err.name === "AbortError" ||
                /ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(err.message || "");
            if (attempt < retries && transient) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                await sleep(delay);
                attempt++;
                continue;
            }
            break;
        }
    }
    throw lastErr;
}

module.exports = { postJSONWithRetries };
