require("dotenv").config();

const express = require("express");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const mountAllRoutes = require("./routes/_loader");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// 1) 按开关启用访问日志
if (process.env.LOG_REQUESTS === "1") {
    app.use(requestLogger);
    console.log("Request logging: ENABLED");
} else {
    console.log("Request logging: DISABLED (set LOG_REQUESTS=1 to enable)");
}

// 2) 自动挂载 routes/** ：URL = "/" + 文件相对路径 (去掉 .js / index)
mountAllRoutes(app);

// 3) 健康检查
app.get("/", (_req, res) => {
    res.status(200).send("OK - Shopify webhook server");
});

// 4) 全局错误处理
app.use(errorHandler);

console.log(
    "[flags]",
    "LOG_REQUESTS=", (process.env.LOG_REQUESTS || "").trim(),
    "SAVE_PAYLOADS=", (process.env.SAVE_PAYLOADS || "").trim(),
    "ALLOW_UNVERIFIED=", (process.env.ALLOW_UNVERIFIED || "").trim()
);

app.listen(PORT, () => {
    console.log(`🚀 Listening on http://localhost:${PORT}`);
    console.log("Routes are auto-mounted based on src/routes/** file paths");
});
