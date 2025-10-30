const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || "0") === "1",
    auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
});

/** 发邮件 */
async function sendMail({ to, cc, bcc, subject, html, text }) {
    const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
    if (!from) throw new Error("FROM_EMAIL/SMTP_USER 未配置");

    const mailOptions = { from, to, subject, html, text };
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;

    return transporter.sendMail(mailOptions);
}

module.exports = { sendMail };
