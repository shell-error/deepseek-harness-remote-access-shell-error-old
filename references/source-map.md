# Source Map

This map records the implementation found against `dsh-v0.1.1-rc.2`. A file may already exist in a newer checkout; inspect it before replacing content.

Legend:

- **New** means the path is absent from that tag and carries the feature implementation.
- **Change** means the upstream file was modified to connect remote behavior.
- **Modern** means current upstream has a different provider-family implementation that should be preferred.

## Network Access Authorization

| Path | Status | Responsibility |
|---|---|---|
| `packages/client/ui-settings-lan-access/package.json` | New | Dual-face package metadata, client injection, `./client` export. |
| `packages/client/ui-settings-lan-access/src/index.ts` | New | Host plugin, request/upgrade gate, durable store, management routes. |
| `packages/client/ui-settings-lan-access/src/protocol.ts` | New | Shared route constants, status/device/snapshot types. |
| `packages/client/ui-settings-lan-access/src/store.ts` | New | Atomic `$DSH_HOME/lan-access.json`, bounded device history, status transitions. |
| `packages/client/ui-settings-lan-access/src/page.ts` | New | HTML waiting/refusal page, escaped values, re-request form. |
| `packages/client/ui-settings-lan-access/src/client/index.ts` | New | Locale and `settings.section` registration. |
| `packages/client/ui-settings-lan-access/src/client/api.ts` | New | Same-origin management fetch carrying `x-dsh-lan-access`. |
| `packages/client/ui-settings-lan-access/src/client/LanAccessSection.tsx` | New | Pending/approved/denied groups and approve/deny/revoke/forget actions. |
| `packages/client/ui-settings-lan-access/src/client/LanAccessSection.module.css` | New | Section-local chrome using Harness theme tokens. |
| `packages/client/ui-settings-lan-access/src/client/locales.ts` | New | Chinese and English copy. |
| `packages/client/ui-settings-lan-access/src/invariant.ts` | New | Package invariant companion. |
| `packages/client/ui-settings-lan-access/tests/lan-access.host.spec.ts` | New | Gate, routes, persistence, security, restart, and malformed-request coverage. |
| `packages/host/webserver/src/index.ts` | Change | Adds request/upgrade gate chain before route dispatch. |
| `packages/bundle/web-app/src/startup.ts` | Change | Adds `--allow-lan`; forces all-interface binding only under explicit consent. |
| `packages/bundle/web-app/cordis.patch.yml` | Change | Mounts the LAN-access plugin. |
| `packages/bundle/web-app/package.json` | Change | Adds the plugin dependency. |
| `packages/client/connection/src/index.ts` | Change | Derives runtime LAN IPv4 authorities for the API trust fence. |
| `packages/client/connection/src/rpc-host.ts` | Change | Reads trusted authorities per request instead of freezing startup values. |
| `packages/client/web/src/boot.ts` | Change | Installs insecure-context browser shims before client bundles load. |
| `packages/client/web/src/secure-context-shim.ts` | New | Supplies APIs missing on plain-HTTP LAN origins. |
| `tsconfig.host.json`, `tsconfig.client.json` | Change | Add host/client compilation references for the plugin. |
| `pnpm-lock.yaml` | Change | Resolve the new workspace package. |
| `start-deepseek-harness.bat` | New in this patch; not an upstream file | Local launcher that opts into `--allow-lan`. Keep it deployment-specific. |

## SSH Host Seam and Filesystem

| Path | Status | Responsibility |
|---|---|---|
| `packages/ssh/ssh/package.json` | New in legacy; Modern package exists upstream | Package identity, `ctx.ssh` export, `ssh2` dependency. |
| `packages/ssh/ssh/src/types.ts` | New in legacy | Registry/draft/probe/listing types and `ssh://` URI helpers. |
| `packages/ssh/ssh/src/store.ts` | New in legacy | Atomic secret-free `$DSH_HOME/ssh-connections.json`. |
| `packages/ssh/ssh/src/secrets.ts` | New in legacy | Separately stored passwords with best-effort owner-only permissions. |
| `packages/ssh/ssh/src/pool.ts` | New in legacy | One pooled `ssh2` session per device, handshake/exec/SFTP timeouts, no replay. |
| `packages/ssh/ssh/src/index.ts` | New in legacy | `SshService`: registry, probe, exec, SFTP, home, listing, URI, disconnect. |
| `packages/ssh/ssh/README.md` | New in legacy | Public seam contract and secrets/URI summary. |
| `packages/ssh/fs-ssh/package.json` | New in legacy; Modern package exists upstream | Filesystem provider metadata. |
| `packages/ssh/fs-ssh/src/index.ts` | New in legacy | `ctx.fs` implementation for local and `ssh://` targets, guarded remote mutations. |
| `packages/ssh/fs-ssh/src/sftp.ts` | New in legacy | Promise wrappers, bounded SFTP streams, numeric status-to-errno mapping, and OpenSSH atomic-overwrite rename. |
| `packages/ssh/fs-ssh/src/uri.ts` | New in legacy | Folds Windows drive-rooted `ssh:` spellings back to the URI. |
| `packages/ssh/fs-ssh/tests/uri.spec.ts` | New in legacy | URI canonicalization and Windows spelling coverage. |
| `packages/bundle/base/cordis.patch.yml` | Change or custom profile | Mounts `dsh-ssh`; replaces the normal FS row with `dsh-fs-ssh` in legacy. |
| `packages/bundle/base/package.json` | Change | Adds both SSH packages to the base bundle dependencies. |

For current upstream, replace the legacy seam rows with the provider-family composition described in `ssh-workspaces.md`. The modern packages add `subprocess-ssh` and `sandbox-ssh`; do not reimplement their responsibilities.

## SSH RPC and Client Service

| Path | Status | Responsibility |
|---|---|---|
| `packages/host/apiproxy/src/api/ssh.ts` | New | Client-visible device/draft/probe contract and `SshApi`. |
| `packages/host/apiproxy/src/api/ssh.schema.ts` | New | Request/response schemas for list/upsert/remove/probe. |
| `packages/host/apiproxy/src/api/index.ts` | Change | Adds `ssh` to `ApiProxy` and re-exports its wire types. |
| `packages/host/apiproxy/src/api/rpc-map.ts` | Change | Registers `ssh.list`, `ssh.upsert`, `ssh.remove`, `ssh.probe`. |
| `packages/host/apiproxy/src/api-proxy.ts` | Change | Maps RPC methods to `ctx.ssh`; validates remote workspace create and agent cwd. |
| `packages/host/apiproxy/src/index.ts` | Change | Exposes `ApiProxyService.ssh`. |
| `packages/host/apiproxy/package.json` | Change | Adds the type-only SSH capability dependency. |
| `packages/client/connection/src/client/api.ts` | Change | Re-exports SSH client contract types. |
| `packages/client/connection/src/client/index.ts` | Change | Re-exports SSH types from the connection client face. |
| `packages/api/remotes/src/client/index.ts` | Change | Re-exports SSH types through the client-safe assembly. |
| `packages/client/runtime/src/client/contract/workspaces.ts` | Change | Adds `sshDevices`, upsert, remove, probe, and connect-failure projection. |
| `packages/client/runtime/src/client/workspaces/service.ts` | Change | Implements the SSH calls over `this.api.ssh` and publishes connect failures. |
| `packages/client/runtime/src/client/index.ts` | Change | Exports the new workspace types. |
| `packages/client/runtime/tests/workspaces-service.client.spec.ts` | Change | Covers SSH service calls and failure publication. |
| `packages/test-support/client-runtime/src/workspaces.ts` | Change | Keeps the test runtime's workspaces double aligned. |

## Workspace, Picker, and Execution World

| Path | Status | Responsibility |
|---|---|---|
| `packages/workspace/workspace/src/paths.ts` | Change | `isRemotePath` and URI-only canonicalization. |
| `packages/workspace/workspace/src/index.ts` | Change | Skip host directory probes for remote workspace roots. |
| `packages/workspace/workspace/src/entity.ts` | Change | Attach/validate remote-cwd sessions without host `stat`. |
| `packages/core/session/src/index.ts` | Change | Permit scheme URIs as absolute session cwd. |
| `packages/sandbox/sandbox-policy/src/index.ts` | Change | Preserve `ssh://` workspace roots for remote providers; host-process consumers sanitize remote cwd themselves. |
| `packages/host/directory-picker-browse/src/index.ts` | Change | Lists and creates remote directories through `ctx.ssh`; emits URI paths. |
| `packages/client/ui-directory-picker-browse/src/client/DeviceMenu.tsx` | New | Add/list/probe/remove device dropdown and remote root selection. |
| `packages/client/ui-directory-picker-browse/src/client/DeviceMenu.module.css` | New | Device switcher and inline form styling. |
| `packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.tsx` | Change | Renders the switcher and adopts remote roots. |
| `packages/client/ui-directory-picker-browse/src/client/flow.ts` | Change | Passes the optional SSH device port into the dialog. |
| `packages/client/ui-directory-picker-browse/src/client/index.ts` | Change | Binds the switcher to `ctx.workspaces` and adds localized copy. |
| `packages/fs/tool-str-replace-editor/src/index.ts` | Change | Resolves tool paths against session cwd and accepts remote URI forms. |
| `packages/shell/bash-local/src/index.ts` | Change | Drops remote cwd before host process spawn. |
| `packages/shell/pwsh-local/src/index.ts` | Change | Drops remote cwd before host process spawn. |
| `packages/terminal/terminal-bash/src/index.ts` | Change | Drops remote cwd before host PTY spawn. |
| `packages/client/ui-conversation/src/client/contract/slots.ts` | Change | Adds connect-failure hook to the conversation contract. |
| `packages/client/ui-conversation/src/client/apply.ts` | Change | Injects the workspace connect-failure store. |
| `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx` | Change | Renders a dismissible failure toast. |
| `packages/client/ui-conversation/src/client/locales.ts` | Change | Adds localized connect-failure copy. |

The three shell/terminal changes are **fallback guards**, not remote execution. Current upstream replaces those local process providers with `subprocess-ssh` when the remote world is selected.

## Test and Type Wiring

The complete diff also touches package tests and aggregate tsconfigs. Keep tests with their owning package and regenerate aggregate references from the project layout when possible. The important negative tests are:

- a remote directory cannot be validated by host `stat`;
- a remote URI cannot become a host cwd;
- `workspace-write` cannot cross connection ids or remote roots;
- LAN management is unreachable from a LAN address;
- an unapproved WebSocket upgrade never starts;
- a stored SSH password never appears in an RPC response.

