# Platform Integration

## Mental Model

DeepSeek Harness (`dsh`) is a Cordis plugin tree. A capability is normally split into small packages instead of one monolith:

- The **host half** owns durable state, secrets, network sockets, filesystems, processes, and RPC implementations.
- A **client half** may be exported as `./client`. Its package manifest declares `dsh.client`, and the client module loader scans enabled Loader rows to serve that bundle to the browser.
- Packages communicate through Cordis services and typed RPC, not by importing a sibling feature's implementation.
- Bundle patch files (`cordis.patch.yml`) decide which plugins a profile mounts. A package that compiles is not active until a profile row mounts it.
- Client slots are extension points. A settings section, for example, registers into `settings.section`; a directory picker fills the workspace's `directoryFlow` holes.

The relevant layers for these features are:

1. **Capability seam**: `ctx.ssh` or the webserver request-gate service.
2. **Consumers**: `ctx.fs`, workspace registry, directory picker, shell/subprocess, terminal.
3. **Transport**: API proxy methods and generated/exported client types.
4. **Business client runtime**: `ctx.workspaces` or a dedicated browser service.
5. **UI**: Settings section or workspace picker.
6. **Composition**: package manifests, tsconfig references, bundle patch rows, pnpm lockfile.

## Discover the Target Version

Run:

```sh
node scripts/audit-harness.mjs /path/to/deepseek-harness
```

The report distinguishes:

- **Legacy multi-device SSH**: `packages/ssh/ssh` contains a durable connection registry and `ssh2` transport; `packages/ssh/fs-ssh` provides SFTP file access; Web picker code carries the device UI. This shape matches `dsh-v0.1.1-rc.2` plus the extension captured in `source-map.md`.
- **Current provider-family SSH**: `packages/ssh` contains `ssh`, `fs-ssh`, `sandbox-ssh`, and `subprocess-ssh`. The upstream provider family owns files, processes, terminals, and sandbox execution. Its documentation still says Web workspace views need separate integration. Reuse these providers and port only the registry/UI/workspace pieces that are genuinely missing.

Do not mix the two blindly:

- The modern `@deepseek-ai/dsh-ssh` is a deployment-owned single OpenSSH alias, not the legacy multi-device JSON registry.
- A multi-device picker on the modern provider family requires a design decision: one provider instance per alias/device, or one connection service that can resolve several aliases. Do this explicitly rather than treating the single provider as a registry.
- If a user only needs one configured remote host, prefer the current provider family plus a custom profile. Add a simpler one-host picker/workspace flow before building a multi-device registry.

## Package And Build Wiring

For every new package, make the integration complete:

1. Add `package.json` with correct `exports`, `files`, dependencies, peer dependencies, and `dsh.client` metadata for any browser half.
2. Add `tsconfig.json`, plus `tsconfig.host.json` and `tsconfig.client.json` only for split packages that need separate compilation.
3. Add the package to the owning bundle's `dependencies`.
4. Add a row to the bundle's `cordis.patch.yml`. Keep the row id stable; later patches address it by id.
5. Add project references to the root host/client tsconfigs when the package participates in aggregate builds.
6. Update `pnpm-lock.yaml` through the package manager, not by hand.
7. Add tests beside the half they exercise. The repository uses `*.host.spec.ts` for the host half of a client package and `*.client.spec.ts[x]` for browser code.

Examples of the expected composer wiring:

```yaml
- id: ui-settings-lan-access
  name: '@deepseek-ai/dsh-client-ui-settings-lan-access'
```

```yaml
- id: ssh
  name: '@deepseek-ai/dsh-ssh'

# In the legacy implementation this replaces the ordinary sandboxed local FS.
- id: fs-sandbox
  name: '@deepseek-ai/dsh-fs-ssh'
```

The current provider family belongs in a custom profile rather than being silently enabled for every deployment. Its configuration includes deployment-owned OpenSSH identity, helper digest, remote Node path, workspace, and lifecycle limits.

## Host Plugin Rules

- Declare required services with `inject`; do not reach into undeclared global state.
- Register cleanup through `ctx.effect(...)` so fiber disposal unregisters routes, watchers, gates, and pools.
- Persist durable state under `dshHomePath(...)`, not beside source files.
- Use atomic writes and locks for user-editable state. Do not leave a truncated JSON file as a valid empty registry.
- Keep secrets out of general-purpose registries. Store password material separately and treat file permissions as best-effort hardening, not strong encryption.
- Make transport failures observable as typed failures or `{ ok: false }` verdicts. Never replay an ambiguous mutation after an SSH disconnect.

## API And Client Rules

- Define the wire contract once on the host and expose only the fields a browser needs.
- Keep method names stable and map them through the RPC map. Include schemas for every request and response when the repository uses schema-backed dispatch.
- Re-export client-safe types through the established connection/API assembly. Do not import host implementation modules into browser bundles.
- A feature package may import a cross-plugin contract type-only. Value imports across feature packages can fail the client bundle-purity gate.
- Fetch client calls should carry the minimum required headers and `credentials: 'same-origin'` when using same-origin host routes.

## Workspace And Path Rules

The legacy remote workspace identity is:

```text
ssh://<connectionId>/<absolute POSIX remote path>
```

That URI is opaque to the host filesystem. Every local path primitive must be conditional:

- Canonicalize remote workspaces by URI grammar, not `realpath`.
- Validate a remote directory through the device's SFTP listing, not host `stat`.
- Keep session cwd as the URI so file tools and sandbox policy share one execution coordinate.
- Do not pass a remote URI to a host process `cwd`. A host shell must either route to a remote subprocess provider or fall back explicitly.
- Sandbox `workspace-write` must compare remote root and target only after remote realpath resolution on the same connection.

## Browser UI Rules

- Register through slots; do not patch another plugin's UI component.
- Localize every label and error. Keep Chinese and English dictionaries key-aligned.
- Re-render from the host response after each mutation rather than optimistically claiming success.
- Preserve recovery: a failed workspace connect should produce visible copy, not a discarded promise.
- Treat password inputs as write-only. An edit form may show that a password exists, never the stored value.

## Verification Commands

Use the scripts actually present in the target checkout. Typical commands are:

```sh
pnpm install
pnpm run build:lib
pnpm run typecheck
pnpm run lint
pnpm vitest run packages/client/ui-settings-lan-access/tests/lan-access.host.spec.ts
pnpm vitest run packages/host/apiproxy/tests/api-proxy-workspace.spec.ts
```

For modern provider-based SSH, use the provider package tests plus the repository's live SSH acceptance test against a disposable POSIX host. Do not replace a live acceptance test with a mock-only success.
