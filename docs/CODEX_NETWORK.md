# Codex / PC

打开 Pages，导入本机自己的 WARP config.json，选择 PC 稳定推荐和 Codex 优化，生成 `mihomo-pc.yaml`。此时只是保存一个新文件，不修改当前 Clash。

CODEX-US 优先 US-STABLE，然后 US-FAST、US-RESERVE、WARP，自动策略无 DIRECT。OpenAI、ChatGPT、GitHub（含 API/raw/assets）、npm、PyPI、Python 的域名规则优先走此组；YouTube 保留高速 WARP 组。

稳定优先能减少择优造成的切换，不能保证长任务永不掉线。公共节点 IP 可变化，US 证据来自上游出口 GeoIP；WARP 兜底不保证美国出口。客户端应继续执行本地健康检查。

## 安全检查

本次未停止、重启或 reload Clash Mi，未调用 selector PUT，未修改系统代理/TUN/网卡或运行旧出口检测器。现有 Controller 9090 的 GET /version 返回 401，未读取或尝试猜测 Secret。

可选本地报告：设置 `MIHOMO_CONTROLLER` 和 `MIHOMO_SECRET`（仅进程环境），运行 `node scripts/readonly-health.mjs <本机已加载的公开provider.yaml>`。它只 GET 指定节点 delay；节点未加载或 401 会退出，不修改配置。输出 artifacts 下的累计脱敏历史，仅包含指纹、延迟、计数和 UNKNOWN 国家；没有真实出口检测能力，不上传任何东西。OpenAI 401 不用 Controller 的不透明 delay 推断为失败；该字段保持未知。

若 Controller 中 provider 节点有前缀，设置 `MIHOMO_NODE_PREFIX` 为 `DIRECT | ` 或 `WARP | `，与本机已加载名称一致。健康报告中的延迟是多个目标的样本汇总；并非吞吐量或精确包丢失率。长期历史需重复采样并可选择人工导入 KV，见 CLOUDFLARE_KV_SETUP.md。

## 启用

把新 YAML 导入/启用到当前 Clash 可能中断 Codex，已列入 HARNESS_REQUIRED.md。本任务仅开发、离线检测及 Preview；生产发布与本机切换由用户决定。
