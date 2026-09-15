require("dotenv").config();
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

async function getCEVAToke() {
    const tokenUrl = process.env.CEVA_TOKEN_URL;
    const clientId = process.env.CEVA_CLIENT_ID;
    const clientSecret = process.env.CEVA_CLIENT_SECRET;

    const body = new URLSearchParams({ grant_type: "client_credentials" });

    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
            "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    };

    const retries = 2;
    const baseDelayMs = 500;
    let attempt = 0;
    let lastErr;

    while (attempt <= retries) {
        try {
            const res = await fetchWithTimeout(tokenUrl, {
                method: "POST",
                headers,
                body: body.toString()
            });

            if (res.ok) {
                const json = await res.json();
                if (!json.access_token) {
                    throw new Error("响应中没有 access_token: " + JSON.stringify(json));
                }

                return json.access_token;
            }

            const text = await res.text().catch(() => "");
            const err = new Error(`获取 CEVA token 失败: ${res.status} ${res.statusText} ${text}`);
            if ([408, 429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
                lastErr = err;
                await sleep(baseDelayMs * Math.pow(2, attempt));
                attempt++;
                continue;
            }

            throw err;
        } catch (err) {
            lastErr = err;
            const transient = err.name === "AbortError" ||
                /ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(err.message || "");
            if (attempt < retries && transient) {
                await sleep(baseDelayMs * Math.pow(2, attempt));
                attempt++;
                continue;
            }
            break;
        }
    }

    throw lastErr;
}

module.exports = getCEVAToke;
