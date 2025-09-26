const { sendMail } = require("../utils/mailer");

const ceva_oos = async (order) => {
    const toEmail = "nz.dev@oppomobile.nz; Sunny.Kim@oppomobile.nz;"; //"Lisa.Naidoo@oppomobile.nz;";
    const subject = `noreply-TTS Items Out of Stock`;
    const html = `
                <div>
                    <p>Hi team,</p>
                    <p>Some items of <strong>TTS ${order.orderID}</strong> maybe out of stock, so the order cannot be created in CEVA. Please refer to the message below</p>
                    <div>
                        <strong>Error Code</strong>: ${order.errorWarnings[0].errorCode}<br/>
                        <strong>Error Description</strong>: ${order.errorWarnings[0].errorDescription}
                    </div>
                </div>`;

    await sendMail({ to: toEmail, subject, html });
};

module.exports = { ceva_oos };
