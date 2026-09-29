---
name: deepseek-harness-remote-access
description: Implement or audit DeepSeek Harness LAN access authorization and SSH-backed remote workspaces across host, browser, API, filesystem, sandbox, workspace, and bundle layers. Use when extending DeepSeek Harness with network approval UI, remote device selection, SSH device registries, or remote workspace support.
metadata:
  short-description: Extend DeepSeek Harness LAN and SSH access
---

# DeepSeek Harness Remote Access

Implement these features against a checkout of DeepSeek Harness:

- **Network access authorization**: a request gate for non-loopback clients, a durable per-address allow list, and a Settings section that approves, refuses, revokes, or forgets devices.
- **SSH-backed workspaces**: a host-side SSH registry and transport, an `ssh://<connectionId>/<absolute path>` workspace identity, an RPC surface, and a workspace picker that can add and select remote devices.

## Start With Evidence

1. Confirm the target is the Harness repository by checking that `package.json` has `"name": "@deepseek-ai/dsh-root"`.
2. Run `node scripts/audit-harness.mjs <repo-root>` from this skill. Use the report to choose the legacy or current implementation path.
3. Read [references/platform-integration.md](references/platform-integration.md) before editing package boundaries or bundle configuration.
4. For network authorization, read [references/lan-access.md](references/lan-access.md).
5. For SSH workspaces, read [references/ssh-workspaces.md](references/ssh-workspaces.md).
6. Use [references/source-map.md](references/source-map.md) to locate each integration seam. The map records the complete implementation against `dsh-v0.1.1-rc.2` and explains how to adapt it to newer provider-based SSH packages.

## Non-Negotiable Invariants

- Inspect the target checkout before copying files. Harness is a developer preview and package contracts change between tags.
- Keep the network gate a reachability layer. It must not widen `/api` trust, sandbox permissions, or tool capabilities. Approved devices still pass every later fence.
- Management of the network allow list is loopback-only, requires the plugin's non-form header, and rejects cross-origin requests. A LAN client may inspect only its own status and re-request access.
- Store the network allow list outside source control, atomically, with bounded growth. Never let unapproved clients grow memory or disk without limit.
- A remote path is addressed only as `ssh://<connectionId>/<absolute path>`. Check that grammar before invoking local `path.resolve`, `realpath`, `stat`, shell, PTY, or sandbox logic.
- Never send a stored SSH password back to the browser. The registry may expose only `hasPassword`; keep key paths and password storage host-owned.
- On current upstream, prefer the existing `packages/ssh/*` provider family (`ssh`, `fs-ssh`, `sandbox-ssh`, `subprocess-ssh`). Do not duplicate it with the legacy `ssh2` implementation. Add only the missing registry, RPC, workspace, and browser integration.
- Do not claim remote shell execution when only `fs-ssh` is mounted. The legacy implementation in the source map makes file tools remote but deliberately falls back to a host cwd for bash, pwsh, and terminal processes.

## Implementation Order

1. Establish the host capability seam and its data contract.
2. Expose the minimum RPC methods and regenerate or update client-facing types.
3. Make workspace identity, validation, and sandbox policy understand remote targets.
4. Add the browser surface and load it through the correct bundle row.
5. Update package manifests, tsconfig references, lockfile, and tests as one coherent change.
6. Run the audit script again, then run the narrowest package tests before repository-wide gates.

## Verification

Use the target repository's documented commands. At minimum, run the focused tests for every package whose host or client half changed, then run the repository's typecheck and lint gates. For manual verification:

- Start the Web profile in LAN mode and confirm a new device sees the waiting page, approval admits it, revoke pages it again, and the host cannot be remotely managed.
- Add an SSH device from the workspace picker, probe it, select a remote directory, create a remote folder, and verify file reads/writes land on the device.
- Confirm the host still serves local workspaces and that wrong-device or wrong-root writes remain denied under `workspace-write`.
- Restart the host and confirm the LAN allow list and SSH device registry persist.

If the target checkout has no remote shell provider, report that boundary explicitly instead of presenting the remote filesystem as a complete remote execution environment.
