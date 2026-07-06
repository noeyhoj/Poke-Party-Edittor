// 1회성 빌드 스크립트: 이미 캐시된 PokeAPI 응답에서 스프라이트 이미지 URL을 뽑아
// public/sprites/*.png 로 한 번만 내려받는다. 앱 런타임은 이 스프라이트를 로컬 정적 파일로만
// 참조하며, 외부 네트워크 호출을 전혀 하지 않는다.
//
// 실행: node scripts/fetch-sprites.mjs

import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE_FILE = path.join(__dirname, '.cache', 'pokeapi-cache.json')
const OUT_DIR = path.join(ROOT, 'public/sprites')

const NATIONAL_DEX_MAX = 1025
const MAX_CONCURRENT = 4
const MIN_INTERVAL_MS = 110

// 고전 46종/48폼(X/Y~ORAS) + 포켓몬 레전드 Z-A 신규 메가진화를 모두 포함한다.
// Mega Dimension DLC 전용 "-mega-z" 폼은 제외한다.
function isMegaVarietyName(name) {
  return name.includes('-mega') && !name.endsWith('-mega-z')
}

const CANONICAL_HISUI_KEYS = new Set([
  'growlithe-hisui', 'arcanine-hisui', 'voltorb-hisui', 'electrode-hisui',
  'typhlosion-hisui', 'qwilfish-hisui', 'sneasel-hisui', 'samurott-hisui',
  'lilligant-hisui', 'zorua-hisui', 'zoroark-hisui', 'braviary-hisui',
  'sliggoo-hisui', 'goodra-hisui', 'avalugg-hisui', 'decidueye-hisui',
])

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

class Semaphore {
  constructor(max) {
    this.max = max
    this.current = 0
    this.queue = []
  }
  async acquire() {
    if (this.current < this.max) {
      this.current += 1
      return
    }
    await new Promise((resolve) => this.queue.push(resolve))
    this.current += 1
  }
  release() {
    this.current -= 1
    const next = this.queue.shift()
    if (next) next()
  }
}

const sem = new Semaphore(MAX_CONCURRENT)
let lastStart = 0

async function downloadImage(url, outPath, attempt = 1) {
  if (existsSync(outPath)) return 'cached'
  await sem.acquire()
  try {
    const now = Date.now()
    const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - now)
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(outPath, buf)
    return 'downloaded'
  } catch (err) {
    if (attempt <= 3) {
      await sleep(500 * attempt)
      return downloadImage(url, outPath, attempt + 1)
    }
    console.error(`[skip] ${url} -> ${err.message}`)
    return 'failed'
  } finally {
    sem.release()
  }
}

async function mapWithLimit(items, limit, fn, onProgress) {
  let nextIndex = 0
  let done = 0
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex
      nextIndex += 1
      await fn(items[i])
      done += 1
      if (onProgress && done % 100 === 0) onProgress(done, items.length)
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()))
}

async function main() {
  const cache = JSON.parse(await readFile(CACHE_FILE, 'utf-8'))
  await mkdir(OUT_DIR, { recursive: true })

  const jobs = []
  for (let dex = 1; dex <= NATIONAL_DEX_MAX; dex += 1) {
    const species = cache[`https://pokeapi.co/api/v2/pokemon-species/${dex}`]
    if (!species) continue

    const defaultVariety = species.varieties.find((v) => v.is_default) || species.varieties[0]
    const baseMon = cache[defaultVariety.pokemon.url]
    if (baseMon?.sprites?.front_default) {
      jobs.push({ id: String(dex), url: baseMon.sprites.front_default })
    }

    for (const v of species.varieties) {
      if (v.is_default) continue
      const isMega = isMegaVarietyName(v.pokemon.name)
      const isHisui = CANONICAL_HISUI_KEYS.has(v.pokemon.name)
      if (!isMega && !isHisui) continue
      const mon = cache[v.pokemon.url]
      if (!mon?.sprites?.front_default) continue
      const id = isMega ? v.pokemon.name : `${dex}-hisui`
      jobs.push({ id, url: mon.sprites.front_default })
    }
  }

  console.log(`[fetch] downloading ${jobs.length} sprites (already-cached files are skipped)`)
  let downloaded = 0
  let failed = 0
  await mapWithLimit(
    jobs,
    MAX_CONCURRENT,
    async (job) => {
      const outPath = path.join(OUT_DIR, `${job.id}.png`)
      const result = await downloadImage(job.url, outPath)
      if (result === 'downloaded') downloaded += 1
      if (result === 'failed') failed += 1
    },
    (done, total) => console.log(`[progress] ${done}/${total}`)
  )

  console.log(`[done] ${jobs.length} sprites processed, ${downloaded} newly downloaded, ${failed} failed.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
