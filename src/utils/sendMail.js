const nodemailer = require("nodemailer");

/** 发邮件 */
async function sendMail({ to, cc, bcc, subject, html, text, key = "" }) {
    const upperKey = key.toUpperCase(); // 确保兼容小写参数
    const user = process.env[`SMTP_USER_${upperKey}`];
    const pass = process.env[`SMTP_PASS_${upperKey}`];
    const from = process.env[`FROM_EMAIL_${upperKey}`] || user;

    if (!user || !pass) throw new Error(`SMTP_USER_${upperKey} 或 SMTP_PASS_${upperKey} 未配置`);

    if (!from) throw new Error("FROM_EMAIL/SMTP_USER 未配置");


    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: (process.env.SMTP_SECURE || "0") === "1",
        auth: { user, pass }
    });

    const mailOptions = { from, to, subject, html, text };
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;

    return transporter.sendMail(mailOptions);
}

module.exports = { sendMail };
