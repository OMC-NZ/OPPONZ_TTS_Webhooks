TTS Shopify Webhook Server (Node/Express)

概述
- 用于接收与处理 Shopify Webhooks 的最小可扩展服务。
- 自动按目录结构挂载路由：src/routes/** 的文件路径即对应 URL 路径（去掉 .js 和末尾 /index）。
- 对需要验签的 Webhook 路径启用 raw body 并进行 HMAC 校验。
- 可通过环境变量开关请求日志与原始 Payload 落盘。

项目结构（节选）
- index.js：程序入口，加载中间件与路由，启动 HTTP 服务。
- src/
  - routes/
    - _loader.js：自动扫描并挂载路由文件。
    - webhooks/
      - paid/
        - shopifyshop-paid.js：处理 orders/paid 等“已支付”相关的 webhook。
      - create/
        - thirdpay.js：第三方支付/创建单相关的 webhook。
        - thirdshop-paid.js：第三方 shop “已支付” webhook。
  - middleware/
    - requestLogger.js：按开关打印请求日志。
    - hmacVerify.js：校验 Shopify 的 X-Shopify-Hmac-SHA256。
    - errorHandler.js：兜底错误处理。
  - utils/
    - files.js：文件/日志工具。
    - postJSONWithRetries.js：带重试的 POST JSON 工具。
    - sendMail.js：发送邮件工具。
  - ceva/、gilrose/、mailContent/：业务相关的下游处理与邮件内容模板。

安装与运行
1) 安装依赖
- 需要 Node.js 16+。
- 在项目根目录执行：
  - npm install

2) 环境变量
- 在项目根目录创建 .env（示例）：
  - PORT=3000                    # 监听端口
  - SHOPIFY_WEBHOOK_SECRET=xxx   # Shopify Webhook Secret（用于 HMAC 校验）
  - LOG_REQUESTS=1               # 1 启用请求日志；其他值关闭
  - ALLOW_UNVERIFIED=0           # 1 允许验签失败继续（仅开发调试用）
  - SAVE_PAYLOAD=0               # 1 将原始 Payload 落盘 logs/ 目录

3) 启动
- npm start 或 node index.js
- 健康检查：GET /

自动路由挂载说明
- src/routes/_loader.js 会递归扫描 src/routes 下所有 .js 文件（忽略以 _ 开头的文件）。
- 计算“文件相对路径 → URL 路径”的映射：
  - 例：src/routes/webhooks/paid/shopifyshop-paid.js → /webhooks/paid/shopifyshop-paid
  - 若文件名为 index.js，则对应其所在目录路径。
- 路由模块需导出一个 Express Router，内部定义相对路径，例如 router.post("/") 即挂载到上述路径。

Shopify HMAC 验签与 raw body
- Shopify Webhook 需要对原始字节进行 HMAC-SHA256 验签。
- 在需要验签的 webhook 路由中��应使用：express.raw({ type: "application/json" })，并且必须在任何 express.json() 之前使用。
- 中间件 src/middleware/hmacVerify.js 会从请求头 X-Shopify-Hmac-SHA256 与原始请求体计算并比对。
- 当 ALLOW_UNVERIFIED=1 时，验签失败也允许继续（仅开发调试）。

关于 X-Shopify-Topic=orders/paid
- Shopify 在回调时会通过请求头 X-Shopify-Topic 标识当前 webhook 的主题。
- 在本项目中，典型处理位于：
  - src/routes/webhooks/paid/shopifyshop-paid.js：专注于“已支付”主题（如 orders/paid）。
- 读取方式：在路由中从 req.headers['x-shopify-topic'] 获取，通常会等于 'orders/paid'（或其他主题）。
- 建议做法：
  - 首先 200 OK 立即 ACK，避免 Shopify 重试；
  - 然后根据 topic 值进行分支处理（若当前路由仅用于 orders/paid，可直接处理）。

日志与排错
- LOG_REQUESTS=1 时，requestLogger 将输出：时间、方法、URL、状态码、耗时。
- 如需调试 payload，将 SAVE_PAYLOAD=1，相关工具会把原始 JSON 文本���入 logs/ 目录（由 utils/files.js 实现）。

常见接入步骤（Shopify 后台）
- 在 Shopify 管理后台 → Settings → Notifications → Webhooks，新增 Webhook：
  - Event：Orders paid（或其他需要的事件）
  - Format：JSON
  - URL：指向本服务的公开可达地址，例如 https://your-domain.com/webhooks/paid/shopifyshop-paid
  - Webhook secret：与 SHOPIFY_WEBHOOK_SECRET 对应
- 保存后，Shopify 会发送测试或实际事件到此 URL。

安全建议
- 生产环境务必设置正确的 SHOPIFY_WEBHOOK_SECRET。
- 关闭 ALLOW_UNVERIFIED（设为 0）。
- 对外仅暴露必要的 webhook 路径。

开发提示
- 若你在代码中看到仅有 "X-Shopify-Topic" 字样而无逻辑（例如 src/routes/webhooks/create/thirdpay.js 的片段），那很可能是注释或占位，请按上述方式在路由里读取并判断 req.headers['x-shopify-topic']。
- 业务下游处理（如 ceva/createOrder.js、gilrose/createOrder.js）可在对应 webhook 路由内调用。

许可证
- 私有/内部使用。