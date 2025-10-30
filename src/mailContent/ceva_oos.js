const { sendMail } = require("../utils/sendMail");

const ceva_oos = async (order) => {
    const toEmail = "nz.dev@oppomobile.nz;"; //"Sunny.Kim@oppomobile.nz; Lisa.Naidoo@oppomobile.nz;";
    const subject = `noreply-TTS Order ${order.orderID} Errors`;
    const html = `
                <div>
                    <p>Hi team,</p>
                    <p>Several items in order <strong>${order.orderID}</strong> appear to be incorrect. Please see the message below for details.</p>
                    <div>
                        <strong>Error Code</strong>: ${order.errorWarnings[0].errorCode}<br/>
                        <strong>Error Description</strong>: ${order.errorWarnings[0].errorDescription}
                    </div>
                </div>`;

    try {
        const info = await sendMail({ to: toEmail, subject, html });
        // console.log("noreply-TTS Order sending successfully:", info);
    } catch (err) {
        console.error("noreply-TTS Order sending failed:", err);
    }
};

module.exports = { ceva_oos };
