#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const json = args.includes('--json')
const strict = args.includes('--strict')
const requireRemoteShell = args.includes('--require-remote-shell')
const rootArg = args.find((arg) => !arg.startsWith('--')) ?? process.cwd()
const root = resolve(rootArg)

function exists(relative) {
  return existsSync(join(root, relative))
}

function read(relative) {
  try {
    return readFileSync(join(root, relative), 'utf8')
  } catch {
    return ''
  }
}

function has(relative, needle) {
  const value = read(relative)
  if (needle instanceof RegExp) return needle.test(value)
  if (typeof needle === 'function') return needle(value)
  return value.includes(needle)
}

function packageJson(relative) {
  try {
    return JSON.parse(read(relative))
  } catch {
    return undefined
  }
}

function check(label, ok, detail) {
  return { label, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }
}

if (!exists('package.json')) {
  console.error(`not a DeepSeek Harness checkout: no package.json under ${root}`)
  process.exit(2)
}

const pkg = packageJson('package.json')
if (pkg?.name !== '@deepseek-ai/dsh-root') {
  console.error(`unexpected package name: ${String(pkg?.name)}`)
  process.exit(2)
}

const lan = {
  package: exists('packages/client/ui-settings-lan-access/package.json'),
  hostHalf: has('packages/client/ui-settings-lan-access/src/index.ts', 'registerRequestGate'),
  durableStore: has('packages/client/ui-settings-lan-access/src/index.ts', 'lan-access.json') || has('packages/client/ui-settings-lan-access/src/store.ts', 'lan-access.json'),
  waitingPage: has('packages/client/ui-settings-lan-access/src/page.ts', 'renderLanAccessPage'),
  settingsSection: has('packages/client/ui-settings-lan-access/src/client/index.ts', "'settings.section'"),
  gateSeam: has('packages/host/webserver/src/index.ts', 'registerRequestGate'),
  allowLanFlag: has('packages/bundle/web-app/src/startup.ts', '--allow-lan'),
  bundleDependency: Boolean(packageJson('packages/bundle/web-app/package.json')?.dependencies?.['@deepseek-ai/dsh-client-ui-settings-lan-access']),
  bundleRow: has('packages/bundle/web-app/cordis.patch.yml', 'ui-settings-lan-access'),
  dynamicApiTrust: has('packages/client/connection/src/index.ts', /lanIpv4Literals|trustedAuthorities/),
  secureContextShim: exists('packages/client/web/src/secure-context-shim.ts'),
  hostTest: exists('packages/client/ui-settings-lan-access/tests/lan-access.host.spec.ts'),
}
lan.checks = [
  check('dual-face package exists', lan.package),
  check('host request gate exists', lan.hostHalf),
  check('durable allow-list exists', lan.durableStore),
  check('waiting/refusal page exists', lan.waitingPage),
  check('settings section exists', lan.settingsSection),
  check('webserver gate seam exists', lan.gateSeam),
  check('--allow-lan parser exists', lan.allowLanFlag),
  check('Web bundle depends on plugin', lan.bundleDependency),
  check('Web bundle mounts plugin', lan.bundleRow),
  check('API trust derives LAN authorities', lan.dynamicApiTrust),
  check('insecure-context browser shim exists', lan.secureContextShim),
  check('host security/persistence tests exist', lan.hostTest),
]
lan.complete = lan.checks.every((entry) => entry.ok)

const ssh = {
  legacyRegistry: has('packages/ssh/ssh/src/types.ts', 'SshConnectionDraft'),
  legacySeam: has('packages/ssh/ssh/src/index.ts', 'class SshService'),
  filesystemProvider: exists('packages/ssh/fs-ssh/src/index.ts'),
  sandboxProvider: exists('packages/ssh/sandbox-ssh/src/index.ts'),
  subprocessProvider: exists('packages/ssh/subprocess-ssh/src/index.ts'),
  apiContract: exists('packages/host/apiproxy/src/api/ssh.ts') || exists('packages/host/apiproxy/src/api/ssh/index.ts'),
  rpcMethods: has('packages/host/apiproxy/src/api/rpc-map.ts', 'ssh.list'),
  clientService: has('packages/client/runtime/src/client/workspaces/service.ts', 'sshDevices'),
  pickerDeviceMenu: exists('packages/client/ui-directory-picker-browse/src/client/DeviceMenu.tsx'),
  remoteBrowse: has('packages/host/directory-picker-browse/src/index.ts', 'ssh://'),
  workspaceUri: has('packages/workspace/workspace/src/paths.ts', 'ssh://'),
  sessionUri: has('packages/core/session/src/index.ts', /REMOTE_CWD|remote.*cwd|scheme URI/i),
  sandboxUri: has('packages/sandbox/sandbox-policy/src/index.ts', 'REMOTE_WORKSPACE_URI_RE'),
  hostCwdGuard: /hostUsableCwd|REMOTE_WORKSPACE_URI_RE/.test(
    read('packages/shell/bash-local/src/index.ts') + read('packages/shell/pwsh-local/src/index.ts') + read('packages/terminal/terminal-bash/src/index.ts'),
  ),
}
ssh.mode = ssh.sandboxProvider && ssh.subprocessProvider
  ? 'modern-provider-family'
  : ssh.legacyRegistry || ssh.legacySeam
    ? 'legacy-multi-device-registry'
    : 'absent'
ssh.remoteExecution = ssh.mode === 'modern-provider-family' || ssh.subprocessProvider
ssh.checks = [
  check('SSH backend exists', ssh.legacySeam || ssh.mode === 'modern-provider-family'),
  check('remote filesystem provider exists', ssh.filesystemProvider),
  check('RPC contract and methods exist', ssh.apiContract && ssh.rpcMethods),
  check('client workspaces service exposes SSH calls', ssh.clientService),
  check('workspace picker device switcher exists', ssh.pickerDeviceMenu),
  check('host directory picker resolves remote targets', ssh.remoteBrowse),
  check('workspace URI canonicalization exists', ssh.workspaceUri),
  check('session cwd accepts remote schemes', ssh.sessionUri),
  check('sandbox policy preserves remote roots', ssh.sandboxUri),
  check('host process cwd guards exist', ssh.hostCwdGuard),
  check('remote shell/subprocess provider exists', ssh.remoteExecution, ssh.remoteExecution ? undefined : 'legacy filesystem-only mode'),
]
ssh.integrationComplete = ssh.checks.filter((entry) => entry.label !== 'remote shell/subprocess provider exists').every((entry) => entry.ok)
ssh.complete = ssh.integrationComplete && ssh.remoteExecution

const actions = []
const warnings = []
if (!lan.complete) {
  actions.push('Implement or finish network access authorization using references/lan-access.md, including the webserver gate, bundle rows, --allow-lan, dynamic API trust, and secure-context shim.')
}
if (ssh.mode === 'absent') {
  actions.push('Choose the SSH architecture first: use the current provider family when present upstream, otherwise port the legacy registry/filesystem design from references/ssh-workspaces.md.')
} else if (!ssh.integrationComplete) {
  actions.push('Complete the SSH workspace integration across RPC, client workspace service, picker, URI/workspace validation, sandbox policy, and tests.')
}
if (ssh.mode !== 'absent' && !ssh.remoteExecution) {
  const boundary = 'Do not claim full remote execution: the detected legacy setup only remotes filesystem-backed workspace operations. Add subprocess/terminal providers for remote commands.'
  if (requireRemoteShell) actions.push(boundary)
  else warnings.push(boundary)
}

const report = {
  root,
  harnessVersion: pkg.version ?? null,
  lan,
  ssh,
  actions,
  warnings,
}

if (json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('DeepSeek Harness Remote Access Audit')
  console.log(`Root: ${root}`)
  console.log(`Version: ${report.harnessVersion ?? 'unknown'}`)
  console.log('')
  console.log('Network access authorization')
  for (const entry of lan.checks) console.log(`  ${entry.ok ? '[x]' : '[ ]'} ${entry.label}${entry.detail ? ` (${entry.detail})` : ''}`)
  console.log('')
  console.log('SSH-backed workspaces')
  console.log(`  mode: ${ssh.mode}`)
  for (const entry of ssh.checks) console.log(`  ${entry.ok ? '[x]' : '[ ]'} ${entry.label}${entry.detail ? ` (${entry.detail})` : ''}`)
  if (warnings.length > 0) {
    console.log('')
    console.log('Boundaries and warnings')
    for (const warning of warnings) console.log(`  - ${warning}`)
  }
  console.log('')
  if (actions.length === 0) {
    console.log('No missing capability wiring detected. Run the package and end-to-end tests next.')
  } else {
    console.log('Recommended next actions')
    for (const action of actions) console.log(`  - ${action}`)
  }
}

if ((strict && actions.length > 0) || (requireRemoteShell && !ssh.remoteExecution)) process.exit(1)




