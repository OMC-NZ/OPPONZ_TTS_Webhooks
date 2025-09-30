require("dotenv").config();
const getCEVAToken = require("./Token");
const { postJSONWithRetries } = require("../utils/postJSONWithRetries");

function toLocalISOStringWithoutTZ(dateStr) {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function normalizeLineDetails(input) {
    const arr = Array.isArray(input) ? input : [input];
    return arr.reduce((acc, item) => {
        const sku = (item.sku ?? "").toString();
        // 如果 sku 含 OPPO，就跳过（不 push）
        if (sku.toUpperCase().includes("OPPO")) {
            return acc;
        }

        // 否则 push 转换后的对象
        acc.push({
            productType: "C",
            branch: "4002",
            productCode: item.sku ?? "",
            requestedQuantity: item.quantity ?? 0,
        });

        return acc;
    }, []);
}

async function createOrder(body) {
    const url = process.env.CEVA_ORDER_URL;
    const token = await getCEVAToken();
    const lineDetails = normalizeLineDetails(body.line_items);
    // 如果过滤后没东西，直接返回，不去调 CEVA
    if (lineDetails.length === 0) {
        console.log(`TTS ${body.name}没有可供CEVA发货的商品`);
        return { skipped: true, message: `TTS ${body.name} has no items available for CEVA to ship` };
    }

    const payload = {
        "senderId": "OPPONZ",
        "orderID": "TTS" + body.name,
        "action": "create",
        "tpid": "BPNZJDE",
        "tpid_version": "ORCH001",
        "billTo": "2086822",
        "shipTo": "2086823",
        "requestedDate": toLocalISOStringWithoutTZ(body.created_at),
        "poRecyclingPeriodInMonths": 99999,
        "shippingAddress": {
            "organisation": body.shipping_address.company ?? "",
            "recipient": body.shipping_address.name,
            "deliveryAddress": body.shipping_address.address1,
            "suburb": body.shipping_address.address2,
            "city": body.shipping_address.province,
            "countryCode": "NZ",
            "postCode": body.shipping_address.zip,
            "mobileNumber": body.shipping_address.phone ?? "",
        },
        "lineDetails": lineDetails,
    };

    const res = await postJSONWithRetries(
        url,
        payload,
        { Authorization: `Bearer ${token}` }, // headers
        { timeoutMs: 15000, retries: 2, baseDelayMs: 500 } // 可调参数
    );

    return res.json();
}

module.exports = createOrder;