const { sendMail } = require("../utils/sendMail");

async function gilroselimitprice(order) {
  const email = order?.customer?.email;
  if (!email) {
    console.warn("gilroselimitprice: 缺少 customer.email, 跳过发送。");
    return;
  }

  const displayName = [order?.customer?.first_name, order?.customer?.last_name].filter(Boolean).join(" ");
  const orderNo = order?.name;

  const subject = `[NO REPLY] OPPO Order ${orderNo} Canceled — Payment Not Received`;

  const html = `
    <p>Hi ${displayName || "there"},</p>
    <p>Thank you for your recent order ${orderNo}]) with OPPO eStore.</p>
    <p>Unfortunately, we are unable to process your payment through Gilrose for this order since it's below the minimum transaction amount required by Gilrose, which is NZD $499 and above.</p>
    <p>We'll be happy to help arrange an alternative payment option so you can receive your order without delay.</p>
    <p>To complete your purchase, please reply to this email (online@oppomobile.nz).</p>
    <br />
    <p>Kind regards,</p>
    <p>OPPO NZ Online Team</p>
  `;

  await sendMail({ to: email, bcc: 'online@oppomobile.nz', subject, html, key: 'ONLINEOPPO' });
  console.log(`Sent Gilrose failure notification to ${email} regarding order ${orderNo}`);
}

module.exports = { gilroselimitprice };
