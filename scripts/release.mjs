import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const npmCommand = 'npm'
const bumpTypes = new Set(['patch', 'minor', 'major'])
const bumpType = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? 'patch'
const dryRun = process.argv.includes('--dry-run')

if (!bumpTypes.has(bumpType)) {
  throw new Error(`不支持的版本类型：${bumpType}。请使用 patch、minor 或 major。`)
}

function run(command, args, captureOutput = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: command === npmCommand && process.platform === 'win32',
    stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  })
  if (result.status !== 0) {
    const detail = captureOutput ? `${result.stdout}${result.stderr}`.trim() : ''
    throw new Error(`${command} ${args.join(' ')} 执行失败${detail ? `：${detail}` : ''}`)
  }
  return result.stdout?.trim() ?? ''
}

function readProjectFile(file) {
  return readFileSync(file, 'utf8')
}

function incrementVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(`无法解析版本号：${version}`)
  }
  const [major, minor, patch] = match.slice(1).map(Number)
  if (bumpType === 'major') {
    return `${major + 1}.0.0`
  }
  if (bumpType === 'minor') {
    return `${major}.${minor + 1}.0`
  }
  return `${major}.${minor}.${patch + 1}`
}

if (run('git', ['status', '--porcelain'], true)) {
  throw new Error('工作区不干净，请先提交或处理现有改动。')
}

const branch = run('git', ['branch', '--show-current'], true)
if (branch !== 'main') {
  throw new Error(`只允许在 main 分支发布，当前分支：${branch || 'detached HEAD'}`)
}

run('git', ['fetch', '--prune', '--tags', 'origin'])
const [ahead, behind] = run('git', ['rev-list', '--left-right', '--count', 'HEAD...origin/main'], true)
  .split(/\s+/)
  .map(Number)
if (ahead !== 0 || behind !== 0) {
  throw new Error(`main 与远端不同步：领先 ${ahead}，落后 ${behind}。`)
}

const packageJson = JSON.parse(readProjectFile('package.json'))
const tauriConfig = JSON.parse(readProjectFile('src-tauri/tauri.conf.json'))
const cargoToml = readProjectFile('src-tauri/Cargo.toml')
const cargoLock = readProjectFile('src-tauri/Cargo.lock')
const cargoVersion = /^version = "([^"]+)"/m.exec(cargoToml)?.[1]
const cargoLockVersion = /name = "shike-alarm"\r?\nversion = "([^"]+)"/.exec(cargoLock)?.[1]
const versions = [packageJson.version, tauriConfig.version, cargoVersion, cargoLockVersion]
if (versions.some((version) => version !== packageJson.version)) {
  throw new Error(`版本号不一致：${versions.join(' / ')}`)
}

const nextVersion = incrementVersion(packageJson.version)
const nextTag = `v${nextVersion}`
const localTag = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/${nextTag}`])
if (localTag.status === 0 || run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${nextTag}`], true)) {
  throw new Error(`标签已存在：${nextTag}`)
}

console.log(`准备发布 ${nextTag}`)
if (dryRun) {
  console.log('试运行完成，未修改文件、提交或推送。')
  process.exit(0)
}

run(npmCommand, ['version', bumpType, '--no-git-tag-version'])
const releasedVersion = JSON.parse(readProjectFile('package.json')).version
if (releasedVersion !== nextVersion) {
  throw new Error(`npm 生成的版本 ${releasedVersion} 与预期版本 ${nextVersion} 不一致。`)
}

tauriConfig.version = nextVersion
writeFileSync('src-tauri/tauri.conf.json', `${JSON.stringify(tauriConfig, null, 2)}\n`)
writeFileSync(
  'src-tauri/Cargo.toml',
  cargoToml.replace(/^version = "[^"]+"/m, `version = "${nextVersion}"`)
)
writeFileSync(
  'src-tauri/Cargo.lock',
  cargoLock.replace(
    /(name = "shike-alarm"\r?\nversion = )"[^"]+"/,
    `$1"${nextVersion}"`
  )
)

run(npmCommand, ['run', 'prepush'])
run('git', ['diff', '--check'])
run('git', [
  'add',
  'package.json',
  'package-lock.json',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json'
])
run('git', ['commit', '-m', `release: 发布 ${nextVersion}`])
run('git', ['tag', nextTag])
run('git', ['push', '--atomic', 'origin', 'main', `refs/tags/${nextTag}`])

console.log(`发布已触发：https://github.com/yao-Hub/alarm-clock/releases/tag/${nextTag}`)
