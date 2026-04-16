require("dotenv").config();
const { postJSONWithRetries } = require("../utils/postJSONWithRetries");

async function createOrder(body) {
    const url = process.env.GILROSE_API_URL;
    const hmacKey = process.env.GILROSE_HMACKEY;

    // 由于Shop Pay账户可能存在信息不完整的情况，故在这里需要进行额外的健壮性验证，确保传输完整性。
    const customer = body.customer;
    const missingFields = [];
    if (!customer.first_name?.trim()) missingFields.push("customer.first_name");
    if (!customer.last_name?.trim()) missingFields.push("customer.last_name");
    if (!customer.email?.trim()) missingFields.push("customer.email");
    if (!customer.phone?.trim()) missingFields.push("customer.phone");
    if (missingFields.length > 0) {
        console.warn("[createOrder] customer 信息缺失", {
            orderName: body.name,
            missingFields
        });

        return {
            success: false,
            code: "CUSTOMER_INFO_LOST",
            message: `${missingFields.join("、")} is empty`
        };
    }

    const payload = {
        "shopifyOrderId": "Shopify" + body.name,
        "totalAmount": body.total_price,
        "storeName": "OPPO NZ",
        "storeNumber": "D6468",
        "customer": {
            "firstName": customer.first_name,
            "lastName": customer.last_name,
            "email": customer.email,
            "phone": customer.phone
        },
        "purchaseDate": body.created_at,
        "eventId": body.id,
        "eventType": "order.created"
    };

    // this one is for testing
    // const payload = {
    //     "shopifyOrderId": "Shopify#0003",
    //     "totalAmount": 1200.00,
    //     "storeName": "OPPO NZ",
    //     "storeNumber": "D6468",
    //     "customer": {
    //         "firstName": "Troy",
    //         "lastName": "Krajancic",
    //         "email": "troy@example.co.nz",
    //         "phone": "6421000000"
    //     },
    //     "purchaseDate": "2025-10-28T01:23:45+12:00",
    //     "eventId": "11709236117657",
    //     "eventType": "order.created"
    // }

    try {
        const res = await postJSONWithRetries(url, payload, {}, {
            clientId: 'GILROSE',
            hmacKey: hmacKey,
            retries: 3,
            baseDelayMs: 1000,
            timeoutMs: 15000,
        });
        const resData = await res.json();

        return {
            success: true,
            data: resData
        };
    } catch (error) {
        console.error("[createOrder] 请求失败", {
            orderName: body.name,
            message: error.message,
            stack: error.stack
        });
        return {
            success: false,
            code: "REQUEST_FAILED",
            message: error.message
        };
    }
}

module.exports = createOrder;