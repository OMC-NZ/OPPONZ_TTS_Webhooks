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

async function postJSONToCEVA(url, body, headers = {}, {
    timeoutMs = 15000,
    retries = 2,
    baseDelayMs = 500,
} = {}) {
    let attempt = 0;
    let lastErr;

    while (attempt <= retries) {
        try {
            const res = await fetchWithTimeout(url, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
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

module.exports = { postJSONToCEVA };
