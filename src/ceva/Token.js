require("dotenv").config();

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

    const res = await fetch(tokenUrl, { method: "POST", headers, body: body.toString() });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`获取 CEVA token 失败: ${res.status} ${res.statusText} ${text}`);
    }

    const json = await res.json();
    if (!json.access_token) {
        throw new Error("响应中没有 access_token: " + JSON.stringify(json));
    }

    return json.access_token;
}

module.exports = getCEVAToke;
