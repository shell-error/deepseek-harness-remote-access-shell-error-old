# SSH-Backed Workspaces

## Choose the Correct Architecture

There are two materially different implementations in the wild.

### Legacy multi-device registry

This is the implementation captured against `dsh-v0.1.1-rc.2`. `packages/ssh/ssh` owns a JSON registry, `ssh2` connection pool, password/key/agent authentication, probes, command execution primitives, and SFTP. `packages/ssh/fs-ssh` implements `ctx.fs` for both local and `ssh://` targets. The browser adds a device switcher to the workspace directory picker.

This model is useful when users must register several ad-hoc SSH hosts from the Web UI. Its important limitation is that the shell, pwsh, and terminal executors still run on the Harness host. The remote workspace is fully reflected for filesystem-backed tools, but it is **not** a complete remote execution world.

### Current POSIX provider family

Current upstream provides:

- `packages/ssh/ssh`: one deployment-owned OpenSSH alias, verified remote helper, private administrative RPC, and authenticated stream forwarding.
- `packages/ssh/fs-ssh`: the remote filesystem provider.
- `packages/ssh/subprocess-ssh`: remote processes and terminals.
- `packages/ssh/sandbox-ssh`: remote sandbox argv/effect policy.

The Harness, model transport, and session storage stay local; files and processes run on the remote host. The upstream README explicitly says Web workspace views still assume host filesystem access and need separate integration.

When this family exists, do not copy the legacy `ssh2` service. Compose the providers in a custom profile and design the missing multi-device layer explicitly.

## Remote Workspace Identity

Use one grammar everywhere:

```text
ssh://<connectionId>/<absolute POSIX remote path>
```

Examples:

```text
ssh://d1c9ab7f/home/alice/project
ssh://d1c9ab7f/etc
```

Rules:

- The connection id is opaque. Never parse it as a hostname or user.
- The path part is always POSIX and absolute on the remote device.
- `posix.normalize` folds `.` and `..`; `posix.resolve` anchors relative paths once a session cwd is known.
- Never call host `path.resolve` on the full URI. On Windows it can become a drive-rooted spelling such as `E:\ssh:\id\path`.
- Never call host `realpath`, `stat`, or `mkdir` for a remote target. Validate through SFTP or the remote provider.
- Session cwd, workspace path, and sandbox root all retain the URI. Consumers distinguish worlds by the URI, not by a separate `remote` boolean.

If a caller may produce `/ssh://...`, recognize that spelling and fold it back to the canonical URI before dispatch.

## SFTP Compatibility Invariants

These details are easy to miss on real servers:

- `ssh2` reports protocol failures with numeric SFTP status codes. Map at least `2 -> ENOENT`, `3 -> EACCES`, and `8 -> ENOTSUP`; treating only string `ENOENT` makes a first-time write look like a transport failure.
- Standard SFTP rename is not reliably an overwrite. Prefer OpenSSH's `posix-rename@openssh.com` extension (`ext_openssh_rename`) for atomic replacement, with standard `rename` only as a compatibility fallback.
- Preserve an `ssh://` workspace root in `ctx.sandboxPolicy`. The remote filesystem fence needs the execution-world URI; local shell and PTY providers must sanitize an unusable remote cwd at their own boundary.
- Add live SSH acceptance coverage for create, overwrite/edit, cross-root denial, and cleanup. Mock-only URI tests cannot catch the three issues above.
## Legacy Host Service

### Registry and secrets

`SshService` is registered as `ctx.ssh`. It owns:

```ts
list(): Promise<SshConnectionInfo[]>
get(id): Promise<SshConnection | undefined>
upsert(draft): Promise<SshConnection>
remove(id): Promise<boolean>
probe(id): Promise<SshProbeResult>
exec(id, command, options): Promise<SshExecResult>
withSftp(id, fn, options): Promise<T>
home(id): Promise<string>
listDirectory(id, path?): Promise<SshDirListing>
uri(id, path): string
disconnect(id): void
```

The durable registry is `$DSH_HOME/ssh-connections.json`. It must contain no password. Authentication kinds are:

- `agent`: use the running SSH agent (`SSH_AUTH_SOCK`, or `pageant` on Windows);
- `key`: store only the private-key file path; read the file only while dialing;
- `password`: store the password in a separate owner-only `$DSH_HOME/ssh-secrets.json`.

The wire view may include `hasPassword: boolean`, never `password`. On edit, an absent/empty password keeps the prior stored one.

Atomic-write the registry. Keep one pooled session per device, invalidate it on error/close/disconnect, and never replay an ambiguous operation after transport loss. Bound handshake, exec, and SFTP-channel waits.

### Filesystem provider

`SshFileSystem` should extend the repository's sandboxed local filesystem provider and replace the normal FS bundle row. For non-`ssh://` targets it delegates unchanged to the local provider. For remote targets it implements the same `FsTarget`, `stat`, read, list, edit, and write contracts over SFTP.

Important remote semantics:

- identity is the remote `realpath`, not the raw URI string;
- reads enforce text/binary and size limits like the local provider;
- writes stage a sibling temporary file and publish with one remote rename;
- create-if-absent uses exclusive-create semantics;
- edit preserves CRLF when detected;
- `workspace-write` permits mutation only when the session workspace URI names the same connection and contains the canonical remote target;
- local/remote containment is always `false`; never let a local root authorize a remote write.

Do not merely register SFTP as a second unrelated service. The existing file tools and sandbox checks should continue to call `ctx.fs`.

### RPC domain

Add a host API domain with the minimum methods:

```ts
interface SshApi {
  list(request): Promise<RpcResponse<{ connections: SshConnectionView[] }>>
  upsert(request): Promise<RpcResponse<{ connection: SshConnectionView }>>
  remove(request): Promise<RpcResponse<{ removed: boolean }>>
  probe(request, signal): Promise<RpcResponse<SshProbeResultView>>
}
```

Wire the domain through the repository's API proxy and RPC map. Add schemas for every request/response. Return a clear unavailable error when `ctx.ssh` is not mounted rather than crashing the API proxy. Re-export client-safe SSH types through the connection/remotes assembly, then add methods to the client `workspaces` service:

```ts
sshDevices(signal?)
sshUpsertDevice(draft)
sshRemoveDevice(id)
sshProbeDevice(id, signal?)
```

A transport failure during `probe` is a result (`{ ok: false, error }`), not necessarily an RPC failure. Registry failures remain RPC errors.

### Workspace and session integration

Remote targets must survive every local shortcut:

- `packages/workspace/workspace/src/paths.ts`: add an `ssh://` canonicalizer independent of `fs.realpath`.
- `packages/workspace/workspace/src/index.ts`: skip local `stat` for remote roots.
- `packages/workspace/workspace/src/entity.ts`: skip local `stat` when attaching remote-cwd sessions.
- `packages/host/apiproxy/src/api-proxy.ts`: validate `workspace.create` through `ctx.ssh.listDirectory`; do not `mkdir` a remote URI on the host.
- `packages/core/session/src/index.ts`: accept a scheme URI as an absolute session cwd.
- `packages/sandbox/sandbox-policy/src/index.ts`: preserve a remote workspace root as execution-world spelling; do not resolve it against the harness host.
- `packages/fs/tool-str-replace-editor/src/index.ts`: resolve relative paths against `exec.agent.session.header.cwd` and accept the remote URI form.

### Directory picker host half

`packages/host/directory-picker-browse/src/index.ts` needs a remote arm:

- parse `ssh://` targets before host path validation;
- list only directories through `ctx.ssh.listDirectory`;
- return every child as the full remote URI;
- build POSIX breadcrumbs rooted at the device home;
- create a folder through SFTP and return its URI;
- keep local browsing unchanged when no SSH service is mounted, or report a precise unavailable error.

### Browser device switcher

The workspace picker is a pure view over the injected workspace service. Add a `DeviceMenu` that:

- lists Local plus all registered SSH devices;
- adds a device with name, host, port, username, and `agent | key | password` auth;
- never echoes a stored password;
- probes and displays platform/uname/home or the failure;
- asks for confirmation before remove;
- hands the owner either `''` for Local or `ssh://<connectionId><home>` for a device;
- adopts the device's probed home when available, otherwise the remote root.

The device switch and directory listing must use the same `ctx.workspaces` service. Do not create a second RPC path in the component.

### Update and error visibility

A remote workspace connect can fail after the user picks it. Add a read-only `connectFailure` projection to the workspace runtime and render it as a toast/message in the conversation root. Do not rely on a discarded promise or console warning; otherwise a failed pick reads as a dead click.

## Adapting to Current Provider-Family SSH

The current providers already solve remote files, subprocesses, terminals, and sandbox execution. For a single configured host:

1. Add a custom profile mounting `ssh`, `fs-ssh`, `subprocess-ssh`, and `sandbox-ssh` with the deployment-owned alias, helper path/hash, remote Node, and workspace.
2. Verify session cwd and tool paths flow through the mounted providers.
3. Add only the Web-side setup/status UI that helps operators understand the configured remote world.
4. Do not ship a device registry until the provider instances have a defined mapping to connection ids.

For multi-device support, design the provider mapping first:

- separate Cordis scopes/instances per device, or
- extend the connection seam so one service resolves multiple aliases while retaining per-device lifecycle.

The UI can stay the same only if the provider layer exposes a stable device id and workspace URI. If it cannot, make that gap explicit instead of faking a registry in the browser.

## Shell and Terminal Boundary

Legacy behavior must be stated plainly:

- `bash-local`, `pwsh-local`, and `terminal-bash` intentionally ignore an `ssh://` cwd and fall back to a host-usable cwd.
- Therefore a legacy remote workspace gives remote file reads/writes and remote-aware sandbox checks, but commands still execute on the Harness host.
- If remote command execution is required, use the current `subprocess-ssh` provider or add a legacy remote shell/subprocess provider. Do not silently run a local command while telling the model it is remote.

## Verification

Test at least:

- key, agent, and password authentication paths; password never crosses back;
- registry persistence and removal;
- SSH URI parsing and POSIX canonicalization;
- remote listing, folder creation, read, edit, and atomic write;
- approved workspace root vs cross-device/cross-root write denial;
- session cwd persistence and restart;
- picker add/probe/remove flow and failed-connect visibility;
- host local workspaces remain unchanged;
- if remote execution is claimed, prove a command, terminal, and process run on the device rather than the harness host.

