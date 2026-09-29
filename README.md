# DeepSeek Harness 局域网和远程工作区

面向 DeepSeek Harness 的 Codex Skill，用于实现两套远程访问能力：

- **局域网访问授权**：等待授权页、持久化白名单、WebSocket 升级拦截，以及设置页中的批准、拒绝、撤销和删除。
- **SSH 远程工作区**：SSH 设备注册、`ssh://<connectionId>/<absolute path>` 工作区标识、远端目录浏览、远端文件读写和沙箱边界。

## 名称与别名

| 位置 | 值 |
| --- | --- |
| 显示名称 | `DeepSeek Harness 局域网和远程工作区` |
| Skill 名 / GitHub 别名 | `deepseek-harness-remote-access` |

`name` 和仓库路径必须继续使用 kebab-case 英文别名，以保证 Codex、GitHub 和 Harness 加载器兼容；用户界面和文档显示中文名称。

## 安装

将仓库克隆或复制到 Codex 技能目录，文件夹名称保持为别名：

```text
$CODEX_HOME/skills/deepseek-harness-remote-access/
```

如果未设置 `CODEX_HOME`，通常对应：

```text
~/.codex/skills/deepseek-harness-remote-access/
```

## 使用

```text
使用 $deepseek-harness-remote-access 在当前 DeepSeek Harness 仓库中实现局域网访问授权和 SSH 远程工作区。
```

Skill 会根据任务加载：

- [平台集成说明](references/platform-integration.md)
- [局域网访问授权](references/lan-access.md)
- [SSH 远程工作区](references/ssh-workspaces.md)
- [源码接线映射](references/source-map.md)

## 审计现有仓库

```sh
node scripts/audit-harness.mjs /path/to/deepseek-harness
```

可选参数：

- `--json`：输出机器可读 JSON
- `--strict`：核心接线缺失时返回失败
- `--require-remote-shell`：把远端命令执行作为硬性要求

## 验证情况

该 Skill 已在真实 DeepSeek Harness 仓库和 Web 应用上验证：

- 聚焦回归测试：170 个通过，1 个平台不适用用例跳过；
- `pnpm run build:lib` 构建通过；
- 局域网等待页、批准、撤销、拒绝、重新申请、删除、持久化和仅回环管理均已验证；
- 已注册 SSH 设备完成连接探测、远端目录浏览、文件创建/读取/编辑、相对路径解析和工作区创建；
- `Workspace Write` 模式下跨工作区远端写入会被拒绝。

验证同时确认了三个容易踩坑的实现细节：保留远端 sandbox root、映射 `ssh2` 数字 SFTP 状态码，以及使用 OpenSSH 原子覆盖 rename 完成远端编辑。

## 重要边界

旧版 SSH 实现会让文件系统和 workspace 感知远端路径，但 `bash`、`pwsh` 和终端仍运行在 Harness 主机上。如果需要完整远端命令执行，应使用当前上游的 `subprocess-ssh` 和 `sandbox-ssh` provider。
