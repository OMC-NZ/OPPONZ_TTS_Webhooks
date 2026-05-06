require("dotenv").config();
const { sendMail } = require("../utils/sendMail");
const { getNZLogTime } = require("../utils/timeUtils");

const ceva_oos = async (order) => {
    const toEmail = process.env.DEVE_EMAIL;
    const toCC = "";
    const subject = `noreply-TTS Order ${order.orderID} Errors`;
    const html = `
                <div>
                    <p>Hi team,</p>
                    <p>Several items in order <strong>${order.orderID}</strong> appear to be incorrect. Please see the message below for details.</p>
                    <div>
                        <strong>Error Type</strong>: ${order.errorWarnings[0].errorType}<br/>
                        <strong>Error Code</strong>: ${order.errorWarnings[0].errorCode}<br/>
                        <strong>Error Description</strong>: ${order.errorWarnings[0].errorDescription}
                    </div>
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
                text: `Error log was saved at '/home/nzdev/.pm2/logs/OPPONZ-TTS-Webhooks-error.log'.`,
                key: "ONLINEKONEC"
            });
        } catch (mailErr) {
            console.error(`[${getNZLogTime()}] Failed to send error notification email:`, mailErr);
        }

        throw err;
    }
};

module.exports = { ceva_oos };
