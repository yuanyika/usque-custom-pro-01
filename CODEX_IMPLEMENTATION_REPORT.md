# Node Pool v7 实现报告

日期：2026-10-07（Asia/Shanghai）。Fork：yuanyika/usque-custom-pro-01。基线：8719fa082b1ddd16e1465cc4718db8e1f926a514。开发分支：codex/node-pool-v7。备份标签：backup-before-node-pool-v7。

## 交付状态

开发实现及云端 Preview 验证完成。生产 main 未合并/覆盖，当前 Clash 未切换。Preview：[固定部署](https://bfac84c5.usque-custom-pro-01-1ua.pages.dev/)；[开发分支入口](https://codex-node-pool-v7.usque-custom-pro-01-1ua.pages.dev/)。分支入口以后可指向新版，固定部署适于复核本次版本。

新增 Source Adapter、严格 YAML 解析和白名单标准化、SHA-256 去重、US 证据过滤、稳定性评分、三层 provider、缓存故障降级、可选 KV 历史、POOL_TOKEN、PC/mobile Profile、Direct/WARP/AUTO 双路径、CODEX-US/AI-US 和开发域名规则。原 WARP/MASQUE 注册、config.json 导入、Shadowrocket、sing-box、VLESS 桥接、原始地区模式和 YouTube WARP 路径保留。

## 文件

- `pages/lib/node-pool/{sources,parse,normalize,dedupe,filter,score,history,provider,api}.js`：聚合核心及 API。
- `src/{pages-worker,workers-worker}.js`：保留 WARP relay、接入 pool。
- `pages/{app.js,index.html,_worker.js}`：界面、配置生成和打包 Worker。
- `workers/src/worker.js`、`workers/public/{app.js,index.html}`：Workers 兼容输出。
- `package.json`、pnpm lock/workspace、`scripts/build.mjs`：固定依赖及可重复构建，原 Pages exit 0 部署仍可用。
- `tests/{pool,frontend}.test.mjs`：自动验证。
- `scripts/{audit-sources,smoke-preview,readonly-health}.mjs`、`download-validator.ps1`：公开源核验、Preview 检查、只读本地报告和隔离语法检测工具。
- 六份 docs、README 入口、`.gitignore` 和 `HARNESS_REQUIRED.md`。

## 源、地区与评分

Au1rxx 保留为唯一启用的主源。实测 437 个 US 上游记录 → 395 个支持的标准节点 → 196 个唯一候选 → Stable 15、Fast 25、Reserve 40。Stable/Fast 有交集，合集实际 65 个，不能把层数相加当唯一节点数。手机 Stable 8 个。

备用源分别核验仓库状态、更新时间、公开使用说明/许可证及实际格式。Barabama 活跃、MIT，但 provider 根结构与解析要求不符，也没有可靠出口国家证据；share-daily 活跃、YAML 可解析，但无明确许可证/美国出口证据。均默认关闭，不假装已实现三源生产容灾。细节见 NODE_POOL_V7.md。

US 来自上游出口 GeoIP 分类，不用名字或国旗判断，也不虚构城市；未进行本机真实出口复测。WARP 兜底不保证美国。评分 35/20/15/15/10/5 权重，未知项中性；无 KV 正常工作但没有长期实测历史。可选 KV 接口已实现，未创建 namespace、开启遥测或上传本机数据。

## 验证结果

15 项 Node 自动测试通过。配置矩阵覆盖 4 模式 × 3 连接路径 × 3 规则模式，共 36 组合；校验所有策略组/provider/rule 引用与下载路径，手机更新/检查间隔及候选上限。

官方 Mihomo v1.19.32（MetaCubeX release）对合成 PC、mobile YAML 执行 `-t` 均成功。仅使用 artifacts/ 内随机生成的无账户测试密钥，未读/导出私人 WARP config，也未启动该核心进程提供代理、占用端口或 reload 主 Clash。合成 YAML 不能联网，不能作为真实使用文件。

云端 Preview：首页 200、health 200、register/enroll GET 405（确认保留路由，未进行真实注册）、pool/status 200/state=ok；stable/fast/reserve/all provider 均 200，可解析、唯一名称分别 15/25/40/65；mobile stable 为 8。Provider 校验无 WARP private-key/access_token/license，没有 skip-cert-verify=true。

首次云端发现 Workers fetch 调用上下文/redirect 兼容 TypeError，已修复并加入回归测试，最终云端全部接口成功。Windows 本地 Worker 启动成功，早期上游拉取失败的诊断由云端实际验证解决；未把本地合成测试当真实节点性能结果。

现有主 Controller 只读 GET /version 返回 401，未访问/猜测 Secret。已只读确认 clashmi/clashmiService 运行，未执行任何停止/restart/reload、selector PUT、系统代理/TUN/网卡改动。最终再次核对进程。

## 使用与剩余操作

PC：打开 Preview、导入自己的 WARP config、选稳定推荐/Codex 优化，导出 mihomo-pc.yaml；切换活动配置由 Harness 按交接文档执行。手机：在手机独立注册/导入本机凭据、选手机推荐，导出 mihomo-mobile.yaml；共享 Pages 公共 provider，不依赖电脑开机。

创建了 HARNESS_REQUIRED.md，仅用于用户批准后的活动配置启用/必要 reload 和回滚，因为这可能让 Codex 失联。本次未调用 Harness、未发送外部消息、未启用配置。没有其它开发工作必须中断 Clash。

仍未验证：实体 Android 客户端、实际运营商线路的节点速度、真实美国出口、账号层面的 OpenAI/ChatGPT 可用性、连续多日历史评分。MASQUE 客户端版本需实际确认。公开节点可能失效；缓存可被驱逐，fallback 不能迁移现有 TCP 会话。KV 历史接口用于低频单管理员快照，有最终一致性和写竞争限制。

Production 发布需要用户在检查 Preview 后另行明确批准；本报告不表示当前 PC/手机网络已切换到 v7。
