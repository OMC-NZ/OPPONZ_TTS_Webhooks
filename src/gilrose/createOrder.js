require("dotenv").config();
const { postJSONWithRetries } = require("../utils/postJSONWithRetries");

async function createOrder(body) {
    const url = process.env.GILROSE_API_URL;
    const hmacKey = process.env.GILROSE_HMACKEY;

    const payload = {
        "shopifyOrderId": "Shopify" + body.name,
        "totalAmount": body.total_price,
        "storeName": "OPPO NZ",
        "storeNumber": "D6468",
        "customer": {
            "firstName": body.customer.first_name,
            "lastName": body.customer.last_name,
            "email": body.customer.email,
            "phone": body.customer.phone
        },
        "purchaseDate": body.created_at,
        "eventId": body.id,
        "eventType": "order.created"
    }

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
            retryDelay: 1000,
        });
        const resData = await res.json();

        console.log(`Gilrose order created for "success: ${resData.Success}, response message: ${resData.Message}, Order ID: ${resData.OrderId}"`);

        return resData;
    } catch (error) {
        console.error(`Failed to create Gilrose order for ${body.name}:`, error);
        throw error;
    }
}

module.exports = createOrder;