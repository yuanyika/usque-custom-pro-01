# Node Pool v7

## 使用和部署

Pages 根目录继续为 `pages/`，线上生产 main 不变。浏览器生成配置仍要求先导入或注册本机自己的 WARP。选择稳定推荐、速度优先或手机推荐；v7 默认仅美国。其它地区继续通过原始节点模式使用。

修改代码后运行 `pnpm install --frozen-lockfile`、`pnpm run build`、`pnpm test`。提交生成的 `pages/_worker.js` 与 `workers/src/worker.js` 后，原来 `pages/`、构建命令 `exit 0` 的 Pages 部署依旧可用，不需 npm 构建。规范源在 `src/` 和 `pages/lib/node-pool/`；不要直接编辑打包文件。Workers 静态前端由同一次构建同步。

Preview：`pnpm run deploy:preview`。始终指定 `--branch codex/node-pool-v7`，不得用 main 发布。Wrangler 部署到现有项目；不创建新项目或付费资源。

## 数据流程

固定 Source Adapter → 有限大小 YAML 解析 → 白名单协议/字段 → SHA-256 指纹 → 去重 → 国家证据过滤 → 可选历史评分 → 分层 → provider YAML。页面和 API 不接收 WARP config.json 作为节点池输入，远程 provider 仅包含公开第三方节点。密码/UUID 是公开节点连接必需字段；status、历史和日志不包含它们。

接口：

- `/api/pool/status`：源状态、更新时间、去重和分层计数。
- `/api/pool/provider/us-stable.yaml`：最多 15 个（mobile 为 8）。
- `/api/pool/provider/us-fast.yaml`：最多 25 个（mobile 为 12）。
- `/api/pool/provider/us-reserve.yaml`：最多 40 个（mobile 为 20）。
- `/api/pool/provider/us-all.yaml`：三层去重合集，最多 80 个（mobile 为 40）。

mobile 参数为 `?profile=mobile`。Stable 与 Fast 可有交集，Reserve 排除已选节点。候选不足时不重复凑数。空 provider 返回 503，使客户端保留最近成功下载的 provider，不以空列表覆盖。旧客户端实际保留缓存行为需要实机确认。

## 源核验（2026-10-07）

主源 [Au1rxx](https://github.com/Au1rxx/free-vpn-subscriptions) 为 MIT，保留其 US 专用列表。其 README 声明使用实际 HTTP-over-proxy 测试和出口 GeoIP；国家证据标为 upstream-geoip。这是上游证据，不是本机实测，也不保证之后出口一直在美国。没有通过名字、国旗或服务器所在地推断出口；不标城市。

[Barabama](https://github.com/Barabama/FreeNodes) 为 MIT，最近更新 2026-10-06，数据公开可下载；其 `provider.yaml` 实测不是本项目要求的 `proxies:` 根格式，且没有可靠出口 GeoIP。默认关闭。

[share-daily](https://github.com/share-daily/node) 最近更新 2026-10-06，Clash YAML 可解析，未发现明确许可证或可靠美国出口证据。默认关闭。两者都不需执行外部 EXE；未执行它们的脚本。

此次不为数量启用不可靠备用源。当前跨源实时容灾尚未启用，主源故障依靠最近可用缓存；有新的可靠来源时仅扩展 Source Adapter。测试中使用合成备用源验证单源故障隔离。

## 评分、缓存与历史

历史成功率 35%，OpenAI 20%，GitHub 15%，延迟中位数 15%，抖动 10%，源新鲜度 5%。未知项取中性值，不伪造成功。没有 KV 时使用当前公开源和未知项评分；不能声称已长期学习。

指纹包含全部保留的协议、server/port、凭据、TLS、SNI、Reality 与 WS/gRPC 等传输字段，排序对象键、忽略名字；不把完整凭据作为历史标识。仅支持 VLESS/VMess/Trojan/SS，并排除弱 SS cipher、不合法地址和字段。上游 skip-cert-verify=true 的节点只能候补；输出强制 false，不能靠关闭证书验证使用。

失败一次降分；连续两次移入 Reserve；三次隔离。恢复后可通过新历史状态重新加入。已有稳定排序在相近 10 分范围保持顺序，KV 可跨刷新保留。Mihomo fallback 仍可能在首选恢复后回到首选，它不是承诺永不换 IP 的会话锁。现有 TCP 会话不能在故障时无缝迁移到另一个出口。

Cache API 缓存快照，900 秒刷新；上游失败时可用最近成功的快照最多 24 小时并标 degraded/stale。缓存每数据中心独立，可能被驱逐；没有 KV 时不是永久持久容灾。KV 仅保存有限历史和稳定指纹顺序，不存公开节点 UUID/password 或用户密钥。写入失败不阻断无历史模式。

## 配置行为

PC：provider 1800 秒，健康检查 300 秒；Mobile：provider 3600 秒，健康检查 900 秒。lazy=true 降低后台活动；mobile 候选更少。老的 YouTube 与其它策略组保留，v7 统一提高过于频繁的组检查间隔。

AUTO 同时创建直连、WARP 中转两种 provider，使用不同名称前缀；fallback 先直连组再 WARP 组。订阅下载路径单独选择 Pages DIRECT 或 Pages 经 WARP；云端到 GitHub 的获取固定由 Worker 完成。客户端仍需能访问 Pages 域名，启动时可用既有 WARP 辅助下载。

CODEX-US：Stable → Fast → Reserve → WARP。不自动加入 DIRECT。OpenAI 健康目标使用 `/v1/models`，允许未认证 401，403、timeout、TLS/DNS 错误不视为成功。这个网络探测不保证登录账号或所有 ChatGPT 产品可用。开发域名规则在广泛 AI/国外规则前，适用于 smart/lite/global 三种规则模式；保留现有流媒体规则集。

可选 `POOL_TOKEN`：保护 status/provider，支持 Bearer header 或 query token；前端导出仅使用 header，不将 Token 写入 URL/Git。Token 输入与生成 YAML 都仅留在设备。历史写入需另一个 `POOL_ADMIN_TOKEN`；匿名客户端不能写入评分。
