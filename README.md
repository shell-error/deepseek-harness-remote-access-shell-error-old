# DeepSeek Harness Remote Access Skill

> 面向 DeepSeek Harness 的 Codex Skill：提供局域网访问授权与 SSH 远程工作区能力。
>
> 中文说明见 [README.zh-CN.md](README.zh-CN.md)。

A Codex skill for extending [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) with:

- network access authorization for LAN clients, including a waiting page, durable allow list, WebSocket gates, and a Settings panel;
- SSH-backed workspace selection, including a device registry, `ssh://` workspace identity, remote directory browsing, and filesystem integration.

The skill is version-aware. It prefers the current upstream `packages/ssh/*` provider family when present and documents the legacy multi-device `ssh2` implementation captured against `dsh-v0.1.1-rc.2`.

## Install

Clone or copy this directory into your Codex skills directory so the folder name is `deepseek-harness-remote-access`:

```text
$CODEX_HOME/skills/deepseek-harness-remote-access/
```

If `CODEX_HOME` is unset, the usual location is `~/.codex/skills/`.

## Use

```text
Use $deepseek-harness-remote-access to implement LAN access authorization and SSH-backed workspaces in this DeepSeek Harness checkout.
```

The skill routes work through:

- `references/platform-integration.md`
- `references/lan-access.md`
- `references/ssh-workspaces.md`
- `references/source-map.md`

## Audit an Existing Checkout

```sh
node scripts/audit-harness.mjs /path/to/deepseek-harness
```

Use `--json` for machine-readable output, `--strict` in CI, or `--require-remote-shell` when remote command execution is mandatory.

## Verified

This skill was validated against a real DeepSeek Harness checkout and the associated Web application:

- focused regression suite: 170 passed, 1 platform-specific test skipped;
- `pnpm run build:lib` completed successfully;
- LAN waiting page, approve, revoke, deny, re-request, forget, persistence, and loopback-only management were exercised;
- a registered SSH device completed probe, remote directory listing, file create/read/edit, relative path resolution, and workspace creation;
- cross-workspace remote writes were denied under `Workspace Write`.

The validation also found and documented three implementation pitfalls: preserving remote sandbox roots, mapping `ssh2` numeric SFTP status codes, and using OpenSSH atomic-overwrite rename for remote edits.

## Important Boundary

The legacy SSH implementation makes the filesystem and workspace remote-aware. Its bash, pwsh, and terminal backends still run on the Harness host. Use the current upstream `subprocess-ssh` and `sandbox-ssh` providers when remote command execution is required.

Chinese overview: [README.zh-CN.md](README.zh-CN.md).




