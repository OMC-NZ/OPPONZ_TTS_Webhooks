Shopify Webhook Server (Node/Express)

一个用于接收 Shopify Webhooks 的最小可扩展服务。特点：
    1. 仅在需要的路由上启用 raw body，并进行 HMAC 验签
    2. 自动挂载 src/routes/** 下的所有路由，文件路径 = URL 路径
    3. 可通过环境变量开关 请求访问日志、是否落盘保存 payload
    4. 项目化拆分：路由 / 中间件 / 工具 / 自动挂载器

文件职责
src/server.js
    - 读取 .env
    - 按开关挂载 requestLogger
    - 调用 routes/_loader.js 自动挂载所有路由文件
    - 提供健康检查（GET /）
    - 最后挂载全局 errorHandler
    - 监听 PORT

src/routes/_loader.js
    - 递归扫描 src/routes 下所有 .js 文件（忽略以 _ 开头的文件）
    - 计算“文件相对路径 → URL 路径”的映射（去掉 .js 和末尾的 /index）
    - require() 路由模块并 app.use(mountPath, router)

src/routes/webhooks/orders/paid.js
    - 对本路由树使用 express.raw({ type: "application/json" })（必须在任何 json() 之前）
    - 使用 hmacVerify 中间件进行 HMAC 验签（X-Shopify-Hmac-SHA256）
    - 处理 POST /：先 200 OK ACK（避免 Shopify 重试），然后打印/解析/（可选）落盘 payload
    - 注意：这个文件被自动挂载到 /webhooks/orders/paid，因此它内部的路由就是 router.post("/")。

src/middleware/requestLogger.js
    - 打印每个请求的 时间、方法、URL、状态码、耗时
    - 由环境变量 LOG_REQUESTS 控制是否启用（在 server.js 中判断）

src/middleware/errorHandler.js
    - 捕获未处理异常并返回 500

src/middleware/hmacVerify.js
    - 基于 原始字节（req.body 是 Buffer）计算 HMAC-SHA256 并与 X-Shopify-Hmac-SHA256 对比
    - ALLOW_UNVERIFIED=1 时，验签失败也允许继续（仅开发调试用；生产务必关闭）

src/utils/files.js
    - saveRawJSON(name, rawText)：把原始 JSON 文本写入 logs/ 目录（自动创建目录）

