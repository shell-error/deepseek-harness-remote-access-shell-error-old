# Network Access Authorization

## Desired Behaviour

`--allow-lan` is the explicit operator opt-in. It binds the webserver to `0.0.0.0`, enables the per-device gate, and prints the actual LAN URL. `--host 0.0.0.0` without `--allow-lan` is a usage error because the API carries code-execution privileges.

When the gate is active:

- Loopback requests bypass the gate.
- An unknown remote address is recorded as `pending` and receives a self-contained waiting page instead of the app.
- A `denied` address receives a refusal page and may submit a re-request form.
- An `approved` address passes through unchanged.
- WebSocket upgrades from unapproved addresses are rejected before any event stream starts.
- Only `/lan-access/status` and `/lan-access/request` are reachable before approval.

The gate grants **reachability**, not privilege. Approved requests still pass the `/api` browser-trust fence, the sandbox, permission prompts, and every other host policy.

## Host Plugin

Use a dual-face package named like `packages/client/ui-settings-lan-access`.

At minimum it needs:

```text
src/
|-- index.ts                 # host gate, routes, durable store wiring
|-- protocol.ts              # shared route/header/wire types
|-- store.ts                 # atomic allow-list persistence
|-- page.ts                  # escaped waiting/refusal HTML
|-- client/
    |-- index.ts             # slot and locale registration
    |-- api.ts               # management fetch client
    |-- LanAccessSection.tsx # settings UI
    `-- locales.ts
```

The host half declares the webserver dependency:

```ts
export const name = 'lan-access'
export const inject = ['webServer']
```

Install both a request gate and a prefix route through effects:

```ts
ctx.effect(() => ctx.webServer.registerRequestGate({
  gateRequest: (request, response) => gateRequest(request, response, store, state),
  gateUpgrade: (request, socket) => gateUpgrade(request, socket, store, state),
}), 'lan-access: request gate')

ctx.effect(() => ctx.webServer.register({
  kind: 'prefix',
  path: '/lan-access',
  handler: (request, response) => serveRoute(request, response, store, state),
}), 'lan-access: routes')
```

If the target webserver lacks request gates, add a general `WebRequestGate` seam first:

```ts
interface WebRequestGate {
  gateRequest?: (req, res) => boolean | Promise<boolean>
  gateUpgrade?: (req, socket, head) => boolean | Promise<boolean>
}
```

Gates run before named routes and the static fallback. A gate returns `true` only after writing a response or closing the socket.

## Wire Contract

Keep these values shared by both halves:

```ts
export const LAN_ACCESS_PREFIX = '/lan-access'
export const LAN_ACCESS_HEADER = 'x-dsh-lan-access'
export const LAN_ACCESS_STATUS_PATH = `${LAN_ACCESS_PREFIX}/status`
export const LAN_ACCESS_REQUEST_PATH = `${LAN_ACCESS_PREFIX}/request`
export const LAN_ACCESS_DEVICES_PATH = `${LAN_ACCESS_PREFIX}/devices`
export const LAN_ACCESS_MUTATIONS = ['approve', 'revoke', 'deny', 'forget']
```

Device status is one of `pending | approved | denied`. The management snapshot reports bind host, port, gate-active state, LAN URLs, and device rows. A device status response reports only the caller's own address/status and refresh interval.

## Security Rules

Management is accepted only when all conditions hold:

1. `request.socket.remoteAddress` is loopback after IPv4-mapped IPv6 normalization.
2. The request carries `x-dsh-lan-access`.
3. If `Origin` exists, its host equals the request `Host`.

The custom header prevents a cross-site HTML form from authorizing a device. The loopback check prevents an approved LAN browser from managing the allow list. Validate `Origin` in addition to the header. Tests should cover:

- network address with a valid-looking header: `403`
- loopback without header: `403`
- loopback with a foreign origin: `403`
- wrong path under the prefix: `404`
- valid loopback management read: `200`

The waiting page should include only the caller's address, the server port, the local URL, and a re-request action for denied clients. HTML-escape every interpolated value.

## Durable Store

Store the whitelist at `dshHomePath('lan-access.json')`. Never place it in the repository or in the session log.

Use the repository's atomic-write and file-lock seam when available. Persist before returning a mutation response. Keep a versioned shape:

```json
{
  "version": 1,
  "devices": [
    {
      "address": "192.168.1.23",
      "label": "192.168.1.23",
      "status": "approved",
      "firstSeenAt": 0,
      "lastSeenAt": 0,
      "requests": 1,
      "approvedAt": 0
    }
  ]
}
```

Non-negotiable store behavior:

- pending rows remember first/last sighting and request count;
- approval is durable across restart;
- revoke returns an approved device to the pending flow;
- deny produces a refusal page;
- forget removes the row entirely;
- malformed rows are dropped rather than crashing the host;
- cap attacker-growable pending rows; preserve human-approved rows when trimming;
- file mode should be owner-only where the platform supports it.

## Settings Section

The browser half registers a dictionary and the Settings slot:

```ts
export const inject = ['slots', 'locale']

ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: 'lan-access',
  order: 40,
  locale: 'settings.lanAccess',
  label: () => t('nav'),
  inject: () => ({ ...client }),
}, LanAccessSection))
```

The UI groups `pending`, `approved`, and `denied`. Each mutation sends:

```ts
fetch(path, {
  method: 'POST',
  headers: { 'x-dsh-lan-access': '1' },
  credentials: 'same-origin',
})
```

Render only the response returned by the host. Show the effective bind state so a loopback-only deployment explains why LAN clients cannot connect. Include both Chinese and English copy.

## Web Composition

The complete Web integration touches more than the plugin package:

- `packages/bundle/web-app/package.json`: add the plugin dependency.
- `packages/bundle/web-app/cordis.patch.yml`: mount the plugin.
- `packages/bundle/web-app/src/startup.ts`: parse `--allow-lan`; force `0.0.0.0`; reject `--host 0.0.0.0` without the flag.
- `docs/user/guide` and CLI help: state the approval behavior and security boundary.
- root tsconfigs: reference both plugin compilation faces.
- `start-deepseek-harness.bat` or equivalent launcher: opt in explicitly; do not make LAN exposure the default by accident.

The API trust fence must accept the machine's current LAN IPv4 literals. Do not freeze them only at startup if interfaces can change; re-read with a short bounded cache. Otherwise the server advertises a LAN URL that its own `/api` fence rejects.

Plain HTTP is not a secure browser context. Before any client bundle loads, install the minimal shims required by the existing browser bundle, such as `crypto.randomUUID` when absent. Do not weaken TLS or origin checks.

## Acceptance Checklist

- Loopback remains usable without approval.
- A first LAN visit receives the waiting page, never the app.
- Approve admits the device; revoke returns it to the waiting page.
- Deny shows the refusal page and re-request works.
- Approved state survives a server restart.
- `--host 0.0.0.0` without `--allow-lan` fails before binding.
- Direct management from the LAN fails even with a guessed header.
- `/api`, plugin bundles, SSE, and WebSocket upgrades are all behind the gate.
