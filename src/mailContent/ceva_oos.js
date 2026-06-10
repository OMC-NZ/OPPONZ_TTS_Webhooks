require("dotenv").config();
const { sendMail } = require("../utils/sendMail");
const { getNZLogTime } = require("../utils/timeUtils");

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const ceva_oos = async (order) => {
    const toEmail = process.env.DEVE_EMAIL;
    const toCC = "";
    const subject = `noreply-TTS Order ${order.orderID} Errors`;
    const errorWarnings = Array.isArray(order.errorWarnings) ? order.errorWarnings : [];
    const sentLineDetails = Array.isArray(order.sentLineDetails) ? order.sentLineDetails : [];
    const errorRows = errorWarnings.map((warning, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(warning.errorType)}</td>
                            <td>${escapeHtml(warning.errorCode)}</td>
                            <td>${escapeHtml(warning.errorDescription)}</td>
                        </tr>`).join("");
    const sentSkuRows = sentLineDetails.map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(item.productCode)}</td>
                            <td>${escapeHtml(item.requestedQuantity)}</td>
                        </tr>`).join("");
    const html = `
                <div>
                    <p>Hi team,</p>
                    <p>Several items in order <strong>${escapeHtml(order.orderID)}</strong> appear to be incorrect. Please compare the CEVA-recognised item format with the SKU values we sent to CEVA.</p>

                    <p><strong>CEVA-recognised format / CEVA response</strong></p>
                    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Error Type</th>
                                <th>Error Code</th>
                                <th>Error Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${errorRows || `<tr><td colspan="4">No CEVA error warning details returned.</td></tr>`}
                        </tbody>
                    </table>

                    <p><strong>SKU values sent to CEVA</strong></p>
                    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>productCode</th>
                                <th>requestedQuantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sentSkuRows || `<tr><td colspan="3">No sent SKU details were captured.</td></tr>`}
                        </tbody>
                    </table>
                </div>`;

    try {
        const info = await sendMail({
            to: toEmail,
            subject: subject,
            html: html,
            key: 'ONLINEKONEC'
        });
        // console.log("noreply-TTS Order sending successfully:", info);
    } catch (err) {
        console.error(`[${getNZLogTime()}] TTS Order sending failed:`, err);

        try {
            await sendMail({
                to: process.env.DEVE_EMAIL,
                subject: `Noreply-TTS Order sending failed ${order.orderID}`,
                text: `Error log was saved at 'logs/errors/OPPONZ-TTS-Webhooks-error.log'.`,
                key: "ONLINEKONEC"
            });
        } catch (mailErr) {
            console.error(`[${getNZLogTime()}] Failed to send error notification email.`, mailErr);
        }

        throw err;
    }
};

module.exports = { ceva_oos };
