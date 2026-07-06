// 1회성 빌드 스크립트: PokeAPI에서 전체 국가도감(1~1025) 데이터를 받아
// src/data/pokemonData.js / src/data/megaEvolutions.js 정적 파일로 구워낸다.
// 앱 런타임은 이 스크립트를 전혀 사용하지 않으며, 완성된 정적 파일만 참조한다.
//
// PokeAPI 서버 부하 방지를 위해:
//  - 동시 요청 4개로 제한
//  - 요청 시작 간 최소 100ms 간격
//  - 모든 응답을 로컬 캐시 파일에 저장해 재실행 시 중복 호출 방지
//
// 실행: node scripts/fetch-pokedex.mjs

import { writeFile, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE_DIR = path.join(__dirname, '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'pokeapi-cache.json')
const OUT_POKEMON = path.join(ROOT, 'src/data/pokemonData.js')
const OUT_MEGA = path.join(ROOT, 'src/data/megaEvolutions.js')

const NATIONAL_DEX_MAX = 1025
const MAX_CONCURRENT = 4
const MIN_INTERVAL_MS = 110

// 공식 메가진화 판별: 국가도감 varieties 중 "-mega" 접미사가 붙은 것은 전부 정식 메가진화다.
// (X/Y~ORAS의 고전 46종/48폼 + 포켓몬 레전드 Z-A에서 새로 추가된 megas 포함)
// 단, "메가 다이맥스 Z" 계열(-mega-z)은 Mega Dimension DLC 전용 별도 폼이라 제외한다.
function isMegaVarietyName(name) {
  return name.includes('-mega') && !name.endsWith('-mega-z')
}

// 레전드 Z-A 신규 메가진화는 PokeAPI에 한글 이름이 아직 없는 경우가 많아,
// 다중 폼(X/Y, 성별, 곁모습)을 구분하는 접미사를 직접 붙여준다.
const MEGA_VARIANT_SUFFIX = {
  'raichu-mega-x': 'X',
  'raichu-mega-y': 'Y',
  'meowstic-male-mega': ' (수컷)',
  'meowstic-female-mega': ' (암컷)',
  'magearna-original-mega': ' (오리지널컬러)',
  'tatsugiri-curly-mega': ' (말림꼬리)',
  'tatsugiri-droopy-mega': ' (처진꼬리)',
  'tatsugiri-stretchy-mega': ' (늘어진꼬리)',
}

function buildMegaName(baseKoreanName, varietyKey, koFormName) {
  if (koFormName) return koFormName
  const suffix = MEGA_VARIANT_SUFFIX[varietyKey] || ''
  return `메가${baseKoreanName}${suffix}`
}

// 포켓몬 레전드 아르세우스에 등장하는 공식 히스이 지방 폼 16종.
// 메가진화와 달리 국가도감 번호는 기본 폼과 같지만, 별개의 선택 가능한 포켓몬으로 취급한다.
const CANONICAL_HISUI_KEYS = new Set([
  'growlithe-hisui', 'arcanine-hisui', 'voltorb-hisui', 'electrode-hisui',
  'typhlosion-hisui', 'qwilfish-hisui', 'sneasel-hisui', 'samurott-hisui',
  'lilligant-hisui', 'zorua-hisui', 'zoroark-hisui', 'braviary-hisui',
  'sliggoo-hisui', 'goodra-hisui', 'avalugg-hisui', 'decidueye-hisui',
])

let cache = {}
try {
  cache = JSON.parse(await readFile(CACHE_FILE, 'utf-8'))
  console.log(`[cache] loaded ${Object.keys(cache).length} cached responses`)
} catch {
  await mkdir(CACHE_DIR, { recursive: true })
}

let dirty = 0
async function flushCache() {
  await writeFile(CACHE_FILE, JSON.stringify(cache))
  dirty = 0
}

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

async function fetchJson(url, attempt = 1) {
  if (cache[url]) return cache[url]

  await sem.acquire()
  try {
    const now = Date.now()
    const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - now)
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()

    const res = await fetch(url)
    if (res.status === 429) {
      if (attempt > 5) throw new Error(`429 giving up: ${url}`)
      await sleep(1000 * attempt)
      return fetchJson(url, attempt + 1)
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    const json = await res.json()
    cache[url] = json
    dirty += 1
    if (dirty >= 60) await flushCache()
    return json
  } catch (err) {
    if (attempt <= 3) {
      await sleep(500 * attempt)
      return fetchJson(url, attempt + 1)
    }
    throw err
  } finally {
    sem.release()
  }
}

function koName(namesArr, fallback) {
  const hit = namesArr?.find((n) => n.language.name === 'ko')
  return hit ? hit.name : fallback
}

function typesOf(pokemonJson) {
  return [...pokemonJson.types]
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name)
}

const STAT_NAME_MAP = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  speed: 'speed',
}

function statsOf(pokemonJson) {
  const stats = {}
  for (const s of pokemonJson.stats) {
    const key = STAT_NAME_MAP[s.stat.name]
    if (key) stats[key] = s.base_stat
  }
  return stats
}

function hasAllStats(pokemonJson) {
  const found = new Set(pokemonJson.stats.map((s) => s.stat.name))
  return Object.keys(STAT_NAME_MAP).every((k) => found.has(k))
}

async function processSpecies(id) {
  const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`)
  const name = koName(species.names, species.name)
  const legal = species.is_legendary || species.is_mythical ? 'check' : 'ok'

  const defaultVariety = species.varieties.find((v) => v.is_default) || species.varieties[0]
  let baseMon
  try {
    baseMon = await fetchJson(defaultVariety.pokemon.url)
    if (!hasAllStats(baseMon)) {
      throw new Error('missing stats in response')
    }
  } catch (err) {
    throw new Error(`dex ${id} base fetch (${defaultVariety.pokemon.url}) failed: ${err.message}`)
  }
  const types = typesOf(baseMon)
  const stats = statsOf(baseMon)

  const megaVarieties = species.varieties.filter(
    (v) => !v.is_default && isMegaVarietyName(v.pokemon.name)
  )

  const megas = []
  for (const mv of megaVarieties) {
    try {
      const megaMon = await fetchJson(mv.pokemon.url)
      const megaForm = await fetchJson(`https://pokeapi.co/api/v2/pokemon-form/${mv.pokemon.name}`)
      if (!hasAllStats(megaMon)) {
        throw new Error('missing stats in response')
      }
      const koFormName = koName(megaForm.form_names, null) || koName(megaForm.names, null)
      const mName = buildMegaName(name, mv.pokemon.name, koFormName)
      megas.push({
        key: mv.pokemon.name,
        name: mName,
        types: typesOf(megaMon),
        stats: statsOf(megaMon),
      })
    } catch (err) {
      console.error(`[skip-mega] dex ${id} mega ${mv.pokemon.name} failed: ${err.message}`)
    }
  }

  const hisuiVarieties = species.varieties.filter(
    (v) => !v.is_default && CANONICAL_HISUI_KEYS.has(v.pokemon.name)
  )

  const hisuiForms = []
  for (const hv of hisuiVarieties) {
    try {
      const hisuiMon = await fetchJson(hv.pokemon.url)
      if (!hasAllStats(hisuiMon)) {
        throw new Error('missing stats in response')
      }
      hisuiForms.push({
        key: hv.pokemon.name,
        types: typesOf(hisuiMon),
        stats: statsOf(hisuiMon),
      })
    } catch (err) {
      console.error(`[skip-hisui] dex ${id} hisui ${hv.pokemon.name} failed: ${err.message}`)
    }
  }

  return { dex: id, name, types, stats, legal, megas, hisuiForms }
}

async function mapWithLimit(items, limit, fn, onProgress) {
  const results = new Array(items.length)
  const failed = []
  let nextIndex = 0
  let done = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex
      nextIndex += 1
      try {
        results[i] = await fn(items[i], i)
      } catch (err) {
        console.error(`[skip] item ${items[i]} failed: ${err.message}`)
        failed.push(items[i])
        results[i] = null
      }
      done += 1
      if (onProgress && done % 25 === 0) onProgress(done, items.length)
    }
  }

  const workers = Array.from({ length: limit }, () => worker())
  await Promise.all(workers)
  return { results, failed }
}

function jsEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

const GEN_RANGES = [
  [1, 151, '1세대'], [152, 251, '2세대'], [252, 386, '3세대'], [387, 493, '4세대'],
  [494, 649, '5세대'], [650, 721, '6세대'], [722, 809, '7세대'], [810, 905, '8세대'],
  [906, 1025, '9세대'],
]

function genLabel(dex) {
  const hit = GEN_RANGES.find(([lo, hi]) => dex >= lo && dex <= hi)
  return hit ? hit[2] : '기타'
}

async function main() {
  console.log(`[fetch] national dex 1-${NATIONAL_DEX_MAX}, concurrency=${MAX_CONCURRENT}`)
  const ids = Array.from({ length: NATIONAL_DEX_MAX }, (_, i) => i + 1)

  let { results, failed } = await mapWithLimit(ids, MAX_CONCURRENT, processSpecies, (done, total) => {
    console.log(`[progress] ${done}/${total}`)
  })
  await flushCache()

  if (failed.length > 0) {
    console.log(`[retry] retrying ${failed.length} failed ids: ${failed.join(', ')}`)
    const retry = await mapWithLimit(failed, MAX_CONCURRENT, processSpecies)
    await flushCache()
    for (let i = 0; i < failed.length; i += 1) {
      const dex = failed[i]
      if (retry.results[i]) {
        results[ids.indexOf(dex)] = retry.results[i]
      }
    }
    failed = retry.failed
  }

  const entries = results.filter(Boolean)
  if (failed.length > 0) {
    console.log(`[warn] still missing ${failed.length} pokemon after retry: ${failed.join(', ')}`)
  }

  entries.sort((a, b) => a.dex - b.dex)

  // 기본 폼 + 히스이 폼을 같은 목록에 펼쳐 담되, 서로 다른 고유 id로 구분한다.
  // (히스이 폼은 국가도감 번호가 기본 폼과 같아 dex만으로는 구분할 수 없다.)
  const flatEntries = []
  for (const e of entries) {
    flatEntries.push({
      id: String(e.dex),
      dex: e.dex,
      name: e.name,
      types: e.types,
      stats: e.stats,
      legal: e.legal,
      regionalForm: null,
    })
    for (const h of e.hisuiForms || []) {
      flatEntries.push({
        id: `${e.dex}-hisui`,
        dex: e.dex,
        name: `히스이 ${e.name}`,
        types: h.types,
        stats: h.stats,
        legal: e.legal,
        regionalForm: 'hisui',
      })
    }
  }

  // ── pokemonData.js ──────────────────────────────
  let lastGen = null
  const lines = []
  lines.push("// 국가도감 기준 전체 데이터. PokeAPI(https://pokeapi.co)에서 자동 생성되었습니다.")
  lines.push("// legal: 'ok'    -> 챔피언스에서 자주 통용되는 포켓몬 (참고용)")
  lines.push("// legal: 'check' -> 전설/준전설/환상의 포켓몬. 레귤레이션에 따라 참전 여부가 갈릴 수 있어 확인 필요")
  lines.push("// regionalForm: null -> 기본 폼 / 'hisui' -> 포켓몬 레전드 아르세우스의 히스이 지방 폼 (메가진화와 달리 별도 포켓몬으로 취급)")
  lines.push('export const POKEMON = [')
  for (const e of flatEntries) {
    const gen = genLabel(e.dex)
    if (gen !== lastGen) {
      lines.push(`  // ── ${gen} ──────────────────────────────────────────`)
      lastGen = gen
    }
    const typesStr = e.types.map((t) => `'${t}'`).join(', ')
    const s = e.stats
    const statsStr = `{ hp: ${s.hp}, attack: ${s.attack}, defense: ${s.defense}, spAttack: ${s.spAttack}, spDefense: ${s.spDefense}, speed: ${s.speed} }`
    const regionalFormStr = e.regionalForm ? `'${e.regionalForm}'` : 'null'
    lines.push(
      `  { id: '${e.id}', dex: ${e.dex}, name: '${jsEscape(e.name)}', types: [${typesStr}], stats: ${statsStr}, legal: '${e.legal}', regionalForm: ${regionalFormStr} },`
    )
  }
  lines.push(']')
  await writeFile(OUT_POKEMON, lines.join('\n') + '\n')

  // ── megaEvolutions.js ───────────────────────────
  const megaLines = []
  megaLines.push('// 기본 폼의 도감 번호를 키로 하는 메가진화 매핑. PokeAPI에서 자동 생성되었습니다.')
  megaLines.push('export const MEGA_EVOLUTIONS = {')
  for (const e of entries) {
    if (!e.megas || e.megas.length === 0) continue
    const variants = e.megas
      .map((m) => {
        const typesStr = m.types.map((t) => `'${t}'`).join(', ')
        const s = m.stats
        const statsStr = `{ hp: ${s.hp}, attack: ${s.attack}, defense: ${s.defense}, spAttack: ${s.spAttack}, spDefense: ${s.spDefense}, speed: ${s.speed} }`
        return `{ key: '${m.key}', name: '${jsEscape(m.name)}', types: [${typesStr}], stats: ${statsStr} }`
      })
      .join(', ')
    megaLines.push(`  ${e.dex}: [${variants}],`)
  }
  megaLines.push('}')
  megaLines.push('')
  megaLines.push('export function hasMega(dex) {')
  megaLines.push('  return Boolean(MEGA_EVOLUTIONS[dex])')
  megaLines.push('}')
  await writeFile(OUT_MEGA, megaLines.join('\n') + '\n')

  const megaCount = entries.reduce((acc, e) => acc + (e.megas?.length || 0), 0)
  const hisuiCount = entries.reduce((acc, e) => acc + (e.hisuiForms?.length || 0), 0)
  console.log(
    `[done] ${flatEntries.length} pokemon entries (${entries.length} species), ${megaCount} mega forms, ${hisuiCount} hisui forms written.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
