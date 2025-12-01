// timeUtils.js
const { format } = require("date-fns-tz");

const TIMEZONE = "Pacific/Auckland";

module.exports = {
    // 1. 毫秒时间戳字符串
    getTimestamp() {
        return Date.now().toString();
    },

    // 2. 日期字符串 "yyyy-MM-dd" in NZ time
    getNZDate() {
        return format(new Date(), "yyyy-MM-dd", { timeZone: TIMEZONE });
    },

    // 3. Full NZ timestamp like "2025-11-17-14-30-00"
    getFormattedNZDateTime() {
        return format(new Date(), "yyyy-MM-dd-HH-mm-ss", { timeZone: TIMEZONE });
    },

    // 4. 获取用于文件名的 timestamped 名称
    getFileNameTimestamp(prefix = "orderError") {
        return `${prefix}_${Date.now()}.json`;
    },

    // 5. 打印日志用的本地时间字符串（带 `/` 和 `,`）
    getNZLogTime() {
        return new Date().toLocaleString("en-NZ", {
            timeZone: TIMEZONE,
            hour12: false,
        });
    },

    // 6. 本地 ISO 时间格式字符串，无时区标志
    toLocalISOStringWithoutTZ(dateStr = new Date()) {
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    },
};
