// 1회성 빌드 스크립트: PokeAPI에서 25개 성격(nature) 데이터를 받아 src/data/natures.js로 구워낸다.
// 성격은 25개뿐이라 별도의 캐시 없이 순차 호출 + 딜레이만으로 서버 부하를 피한다.
//
// 실행: node scripts/fetch-natures.mjs

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_FILE = path.join(ROOT, 'src/data/natures.js')

const NATURE_KEYS = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
]

const STAT_KEY_MAP = {
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  speed: 'speed',
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function koName(namesArr, fallback) {
  const hit = namesArr?.find((n) => n.language.name === 'ko')
  return hit ? hit.name : fallback
}

async function main() {
  const natures = []
  for (const key of NATURE_KEYS) {
    const res = await fetch(`https://pokeapi.co/api/v2/nature/${key}`)
    if (!res.ok) throw new Error(`HTTP ${res.status} for nature ${key}`)
    const json = await res.json()
    natures.push({
      key,
      name: koName(json.names, key),
      plus: json.increased_stat ? STAT_KEY_MAP[json.increased_stat.name] : null,
      minus: json.decreased_stat ? STAT_KEY_MAP[json.decreased_stat.name] : null,
    })
    await sleep(120)
  }

  const lines = []
  lines.push("// 25개 성격 데이터. PokeAPI(https://pokeapi.co)에서 자동 생성되었습니다.")
  lines.push("// plus/minus: null이면 변화 없는 무성격(중립) 성격")
  lines.push('export const NATURES = [')
  for (const n of natures) {
    lines.push(
      `  { key: '${n.key}', name: '${n.name}', plus: ${n.plus ? `'${n.plus}'` : 'null'}, minus: ${n.minus ? `'${n.minus}'` : 'null'} },`
    )
  }
  lines.push(']')
  lines.push('')
  lines.push('export const NATURE_BY_KEY = new Map(NATURES.map((n) => [n.key, n]))')
  await writeFile(OUT_FILE, lines.join('\n') + '\n')
  console.log(`[done] ${natures.length} natures written.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
