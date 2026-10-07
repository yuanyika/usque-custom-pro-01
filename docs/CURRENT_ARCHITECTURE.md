# v6.17 实际架构（改造前基线）

基线：`8719fa082b1ddd16e1465cc4718db8e1f926a514`，Fork 为 yuanyika/usque-custom-pro-01。

`pages/app.js` 在浏览器读取 config.json，生成 MASQUE 节点和 Clash/Mihomo、Shadowrocket、sing-box、VLESS 桥接配置。私钥仅用于本地输出；不使用 localStorage。`usque-register.js` 使用 WebCrypto 生成 P-256 私钥，注册和 enroll 公钥走同源 `/api/warp/*`。原有 enroll 流程必须向 Cloudflare WARP API 传递设备 token，这是已有注册协议；v7 不扩展这些凭据的使用或存储。

免费节点源固定为 Au1rxx 的 `output/by-country/clash-${country}.yaml`。客户端按勾选地区生成 general / ai / stream 三个 provider，各自下载同一地区订阅，分别检测 204、ChatGPT、Netflix。`freeUseWarp` 同时控制 provider 下载代理和节点的 dialer-proxy。节点池没有服务端聚合、指纹去重或历史数据库。

分流实际包含 WARP、AI、流媒体、YouTube、Telegram、微软、苹果、Cloudflare、国外网站等策略组；部分页面文字称只有三个主组，与实际代码不完全相同。OpenAI 在 smart 模式由 `🤖 AI` 规则处理，旧版部分 ChatGPT 设置未作用到这些规则。YouTube 保持独立 WARP 极速组。

Pages 使用 `pages/` 作为根目录，`_routes.json` 将 `/api/*` 交给 `_worker.js`，其它文件由静态资产处理。Worker 原来仅有 health、register、enroll。Workers 版使用 `workers/src/worker.js` 和 `workers/public`，两份前端原来重复维护，v7 构建时同步。

`warp-egress-selector.py` 会 PUT 隐藏 selector，再通过本机代理查询出口，可能修改当前代理组；本次未运行它。v7 的只读辅助脚本仅 GET delay，无法据此证明真实出口国家。

v7 增量改动详见 NODE_POOL_V7.md；WARP 注册、私钥处理以及其它客户端输出保留原实现。
