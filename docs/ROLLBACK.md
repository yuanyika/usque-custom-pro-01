# 回滚

生产 main 未改动。开发分支 `codex/node-pool-v7` 的基线备份标签为 `backup-before-node-pool-v7`，指向 8719fa082b1ddd16e1465cc4718db8e1f926a514。禁止 force push 或重写生产历史。

最轻回退：页面选“原始节点 · v6.17”并重新生成。服务端设置 `NODE_POOL_V7=false`、重新部署后，status 标 disabled，页面载入时会恢复原始模式。远程已导出的 v7 YAML 不会神奇变回旧配置；需重新导出/导入，或使用保留的旧本地配置。切换当前活动配置交给 Harness。

Pages 回滚：在 Cloudflare 对现有 Production 选择旧的成功 deployment 回滚，需用户批准。此次开发 Preview 不替换 Production。不要删除旧 deployment。若仅停止试用，停止使用 Preview 即可。

代码回滚：创建基于备份标签的新回滚分支，或者对合并到 main 的 v7 提交做 git revert 后经 PR 审核；不使用 reset --hard 或 force push。不要对当前 Clash 做重启来验证回滚。
