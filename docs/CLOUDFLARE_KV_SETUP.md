# 可选历史 KV

未绑定 KV 时默认正常运行，无需创建云资源。此次没有创建 KV 或付费资源，也未开启自动遥测。

如要增强长期评分，用户可自行在现有免费额度内创建 namespace，并在 Pages Preview 环境绑定为 `POOL_HISTORY`。Production 绑定需用户自行批准。Workers 版在 wrangler 配置中添加对应 binding。先核对账户额度；本项目不自动扩容或创建收费资源。

KV 仅保存 `pool-history-v7`：nodes 为 SHA-256 指纹 → 白名单统计，stable 为上次稳定池指纹顺序。不会保存 UUID、password、私钥、license、设备 token、浏览历史或 Controller Secret。

配置不同的 `POOL_ADMIN_TOKEN` Secret，用于手动 POST `/api/pool/history`。若同时设置 POOL_TOKEN，请将它作为 query token，将 admin token 放在 Authorization header。历史 body 是最多 80 项的绝对累计统计快照；保留字段 success_count、failure_count、consecutive_failures、last_success/last_failure/last_seen（毫秒）、latency_median/p95、jitter、openai_ok、github_ok、country（US/UNKNOWN/NON-US）。不要上传带私钥的 config.json。未知字段整批拒绝。

`readonly-health.mjs` 可以生成本地统计，但本次未运行/上传。需要准确国家和 OpenAI HTTP 状态时，须使用经过隔离审查的 Probe 实例；本次没有启动 Probe。服务端本身不扫描节点、不根据裸 server IP 判定出口。

失败统计移入候补/隔离后，管理员可上传新的恢复快照重新入池。KV 写入和读取失败会降级，无 KV 工作路径仍有效；当前实现的低频 ranking 与手动 history 写入存在 KV 最终一致性及并发写竞争，单管理员、低频更新适用，未宣称高频多客户端遥测系统。
