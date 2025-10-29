const { sendMail } = require("../utils/mailer");

async function gilroselimitprice(order) {
  const email = order?.customer?.email;
  if (!email) {
    console.warn("gilroselimitprice: 缺少 customer.email, 跳过发送。");
    return;
  }

  const displayName = [order?.customer?.first_name, order?.customer?.last_name].filter(Boolean).join(" ");
  const total = order?.total_price;
  const orderNo = order?.name;

  const subject = `[NO REPLY] OPPO Order ${orderNo} Notice Regarding Your Order Payment`;

  const html = `
    <p>Hi ${displayName || "there"},</p>
    <p>Thank you for your recent order ([Order No.: ${orderNo}]) with OPPO.</p>
    <p>We're writing to let you know that the total amount of your purchase (NZD <strong>${total}</strong>) is below the minimum transaction threshold required by Gilrose (NZD <strong>$499</strong>). As a result, we are unable to process payment for this order via Grilrose.</p>
    <p>To complete your purchase, please contact us and we will assist you with an alternative payment method.</p>
    <br />
    <p>Kind regards,</p>
    <p>OPPO NZ</p>

  `;

  await sendMail({ to: email, subject, html });
  console.log(`Sent Gilrose failure notification to ${email} regarding order ${orderNo}`);
}

module.exports = { gilroselimitprice };
