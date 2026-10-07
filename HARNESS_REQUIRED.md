# Harness：人工批准后的本机配置切换

本任务已开发新 PC/mobile 配置和 Preview。Codex 全程不触碰当前运行中的 Clash Mi；新配置启用可能替换活动路由并使 Codex 失联，所以这一项单独交给不依赖 Clash 的 Harness。没有开发、打包、Preview 部署需要停止 Clash。

## 前提

用户已经测试 Preview 并明确决定启用本机新版。用户从 Preview 导入自己的本地 WARP config.json，下载真实 `mihomo-pc.yaml`。仓库 artifacts 下的 YAML 是合成测试凭据，不能联网，不可用作真实配置。

## 执行

1. 只读确认当前 Clash Mi 活动 profile、版本、进程及系统代理/TUN 状态；本地备份当前 profile、provider 缓存和相关设置到用户指定的私有目录，勿提交/上传任何凭据。
2. 使用实际核心对新 YAML 做离线 -t。确认 provider 域名是批准的 Pages 地址，只有公开 provider，CODEX-US 无 DIRECT，WARP 私钥只在本地。保存旧配置作为即时回退。
3. 优先客户端正常导入到一个新 profile，保留旧 profile。仅在用户批准后启用新 profile；如需 reload 或重新建立 TUN，只做该客户端必要动作。不停止服务、重置网络或删除旧配置来“解决”普通故障。
4. 验证 Pages provider 成功更新，US-STABLE/FAST/RESERVE 与 CODEX-US 存在。通过指定新策略查询实际出口国家，再测试 GitHub、npm/PyPI、OpenAI 网络（未认证 401 可表示到达）。不可把服务登录失败简单等同于网络失败。
5. 检查 Codex 能恢复连接，并确认 YouTube 与国内路由仍符合用户设置。手机在自己网络导入自己的 Mobile YAML，独立检查 provider；电脑关机后手机仍应可更新。

## 恢复与回滚

无法获取 provider 或 Codex 失联时立即切回原 profile，恢复之前的代理/TUN 设置；不更改监听端口，不动网卡/Winsock。不删除失败的新 profile，以便离线诊断。恢复后核对原进程、端口及原出口，并将不含密钥的结果报告给用户。

Harness 不负责生产发布；Cloudflare Production 仍需用户另行决定。此文件只准备交接，本次没有发送给另一个 Agent 或执行切换。
