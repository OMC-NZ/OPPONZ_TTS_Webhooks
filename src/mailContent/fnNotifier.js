const { sendMail } = require("../utils/mailer");

/**
 * 当 payment_gateway_names 包含 FN 时调用
 * - 取 customer.email
 * - 生成链接：https://myshopify.com/<first+last+total_price>（路径做 URL 编码）
 * - 把链接塞进邮件正文并发送
 */
async function notifyFn(order) {
    const email = "nz.dev@oppomobile.nz" //order?.customer?.email;
    if (!email) {
        console.warn("notifyFn: 缺少 customer.email, 跳过发送。");
        return;
    }

    const first = order?.customer?.first_name;
    const last = order?.customer?.last_name;
    const total = order?.total_price;

    // 组合并做 URL 编码，去掉内部空白
    const slug = `${first}${last}${total}`.replace(/\s+/g, "");
    const link = `https://myshopify.com/${encodeURIComponent(slug)}`;  // 等着再完善url和看看传什么数据过去

    const subject = `[NO REPLY] Order ${order.name} payment notice`;
    const displayName = [first, last].filter(Boolean).join(" ");

    const html = `
    <p>Hi ${displayName || "there"},</p>
    <p>Your order total is <strong>${order.currency || ""} ${total}</strong>.</p>
    <p>Link: <a href="${link}" target="_blank" rel="noopener">${link}</a></p>
  `;

    await sendMail({ to: email, subject, html });
    console.log(`✉️ 已向 ${email} 发送 FN 通道通知`);
}

module.exports = { notifyFn };
