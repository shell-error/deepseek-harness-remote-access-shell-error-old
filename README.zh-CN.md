# DeepSeek Harness 远程访问 Skill

这是一个用于扩展 DeepSeek Harness 的 Codex skill，覆盖两项能力：

- 局域网访问授权：等待授权页、持久化白名单、WebSocket 升级拦截、设置页审批/拒绝/撤销/删除。
- SSH 工作区：SSH 设备注册、`ssh://<connectionId>/<path>` 工作区标识、远端目录浏览、远端文件读写与沙箱边界。

Skill 会先检测当前 Harness 版本：

- 如果仓库已有新版 `packages/ssh/*` provider family，优先复用 `ssh`、`fs-ssh`、`subprocess-ssh`、`sandbox-ssh`。
- 如果仓库对应 `dsh-v0.1.1-rc.2`，参考其中的旧版 `ssh2 + SFTP` 多设备实现，以及后续补上的 RPC、workspace、picker 接线。

## 安装

把整个目录复制到 Codex skills 目录，并保证目录名为 `deepseek-harness-remote-access`：

```text
$CODEX_HOME/skills/deepseek-harness-remote-access/
```

如果没有设置 `CODEX_HOME`，通常对应 `~/.codex/skills/`。

## 使用

```text
Use $deepseek-harness-remote-access to implement LAN access authorization and SSH-backed workspaces in this DeepSeek Harness checkout.
```

## 审计现有仓库

```sh
node scripts/audit-harness.mjs /path/to/deepseek-harness
```

支持 `--json`、`--strict`，以及把远端命令执行作为硬要求的 `--require-remote-shell`。

## 关键边界

旧版 SSH 实现会让文件系统和 workspace 感知远端路径，但 bash、pwsh、terminal 仍然在 Harness 主机上执行。如果需要完整远端命令执行，应使用当前上游的 `subprocess-ssh` 与 `sandbox-ssh` provider。

