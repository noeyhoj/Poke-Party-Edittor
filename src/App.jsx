import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Search, RotateCcw, Check, X,
  Sword, Shield, HeartHandshake, Sparkles, Users, Info, Sun, Moon, Gem,
} from 'lucide-react'
import { TYPES, TYPE_LABEL_KO, TYPE_COLOR, combinedMultiplier, getMultiplier } from './data/typeChart'
import { POKEMON } from './data/pokemonData'
import { MEGA_EVOLUTIONS, hasMega } from './data/megaEvolutions'
import { NATURES, NATURE_BY_KEY } from './data/natures'

const STORAGE_KEY = 'poke-party-editor:team'
const TEAM_PRESETS_KEY = 'poke-party-editor:presets:team'
const OPPONENT_PRESETS_KEY = 'poke-party-editor:presets:opponent'
const THEME_STORAGE_KEY = 'poke-party-editor:theme'
const MAX_TEAM_SIZE = 6
const SPEED_SCALE_MAX = 220

// 포켓몬 챔피언스는 레벨 50 고정 실전 배틀, 개체값(IV) 31 고정을 전제로 한다.
const BATTLE_LEVEL = 50
const MAX_TRAIT_PER_STAT = 32
const MAX_TRAIT_TOTAL = 66
const COMPUTED_STAT_SCALE_MAX = 400
const DEFAULT_NATURE = 'hardy'
const DEFAULT_ITEM = 'none'

// 메가스톤 외에 실전에서 자주 쓰이는 대표 도구들. statKey/mult가 있는 항목만 실전 능력치에 반영된다.
// (실제 게임 내 공식 한국어 명칭 기준)
const HELD_ITEMS = [
  // ── 능력치를 직접 배율로 바꾸는 도구 ──
  { key: 'choice-band', name: '구애머리띠', statKey: 'attack', mult: 1.5, note: '공격 ×1.5 (기술 고정)' },
  { key: 'choice-specs', name: '구애안경', statKey: 'spAttack', mult: 1.5, note: '특공 ×1.5 (기술 고정)' },
  { key: 'choice-scarf', name: '구애스카프', statKey: 'speed', mult: 1.5, note: '스피드 ×1.5 (기술 고정)' },
  { key: 'assault-vest', name: '돌격조끼', statKey: 'spDefense', mult: 1.5, note: '특방 ×1.5 (변화기 사용 불가)' },
  // ── 정보 제공용(실전 능력치 수치에는 반영되지 않는 배틀 효과) ──
  { key: 'leftovers', name: '먹다남은음식', note: '매 턴 최대 HP 1/16 회복' },
  { key: 'life-orb', name: '생명의 구슬', note: '기술 위력 ×1.3, 사용 시 반동 데미지(최대 HP 1/10)' },
  { key: 'focus-sash', name: '기합의띠', note: 'HP가 가득 찬 상태에서 원킬 공격을 HP 1로 버팀 (1회용)' },
  { key: 'focus-band', name: '기합의머리띠', note: '기절할 공격을 약 10% 확률로 HP 1로 버팀 (재사용 가능)' },
  { key: 'rocky-helmet', name: '울퉁불퉁멧', note: '접촉 기술을 맞으면 상대에게 최대 HP 1/6 반사 데미지' },
  { key: 'expert-belt', name: '달인의띠', note: '효과가 굉장한(약점을 찌르는) 기술의 위력 ×1.2' },
  { key: 'weakness-policy', name: '약점보험', note: '효과가 굉장한 공격을 맞으면 공격·특공 2랭크 상승 (1회용)' },
  { key: 'air-balloon', name: '풍선', note: '땅 타입 기술 무효화 (피격 시 소멸)' },
  { key: 'shell-bell', name: '조개껍질방울', note: '입힌 데미지의 1/8만큼 HP 회복' },
  { key: 'big-root', name: '큰뿌리', note: 'HP 흡수 기술의 회복량 증가' },
  { key: 'eviolite', name: '진화의휘석', note: '진화 가능한(미완성) 포켓몬 한정 방어·특방 ×1.5 (자동 계산에는 미반영, 진화 가능 여부 직접 확인)' },
]
const HELD_ITEM_BY_KEY = new Map(HELD_ITEMS.map((it) => [it.key, it]))
const ALL_MEGA_KEYS = new Set(Object.values(MEGA_EVOLUTIONS).flat().map((v) => v.key))

const ROLE_OPTIONS = [
  { value: '', label: '역할 미지정' },
  { value: 'ace', label: '에이스' },
  { value: 'tank', label: '탱커' },
  { value: 'support', label: '서포터' },
]

// 배틀 규정 기준 선출 인원 (배틀 스타디움 규정: 싱글 3마리, 더블 4마리 선출)
const BATTLE_FORMATS = [
  { key: 'single', label: '싱글배틀', count: 3 },
  { key: 'double', label: '더블배틀', count: 4 },
]

const ROLE_META = {
  ace: { label: '에이스', icon: Sword, color: 'var(--red)' },
  tank: { label: '탱커', icon: Shield, color: 'var(--cyan)' },
  support: { label: '서포터', icon: HeartHandshake, color: 'var(--violet)' },
}

const STAT_META = [
  { key: 'hp', label: 'HP', color: 'var(--green)' },
  { key: 'attack', label: '공격', color: 'var(--red)' },
  { key: 'defense', label: '방어', color: 'var(--amber)' },
  { key: 'spAttack', label: '특공', color: 'var(--violet)' },
  { key: 'spDefense', label: '특방', color: '#b98bff' },
  { key: 'speed', label: '스피드', color: 'var(--cyan)' },
]

const POKEMON_BY_ID = new Map(POKEMON.map((p) => [p.id, p]))

const GEN_RANGES = [
  [1, 151, 1], [152, 251, 2], [252, 386, 3], [387, 493, 4],
  [494, 649, 5], [650, 721, 6], [722, 809, 7], [810, 905, 8],
  [906, 1025, 9],
]
const GENERATIONS = GEN_RANGES.map(([, , gen]) => gen)

function generationOf(dex) {
  const hit = GEN_RANGES.find(([lo, hi]) => dex >= lo && dex <= hi)
  return hit ? hit[2] : 0
}

function canMegaEvolve(p) {
  return !p.regionalForm && hasMega(p.dex)
}

function initialOf(name) {
  const stripped = name.startsWith('히스이 ') ? name.slice(4) : name
  return stripped.slice(0, 1)
}

function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const r = Math.min(255, Math.max(0, (num >> 16) + amt))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function emptyTraitPoints() {
  return { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }
}

function sanitizeTraitPoints(raw) {
  const points = emptyTraitPoints()
  if (!raw || typeof raw !== 'object') return points
  let total = 0
  for (const key of Object.keys(points)) {
    const v = Math.max(0, Math.min(MAX_TRAIT_PER_STAT, Math.floor(Number(raw[key]) || 0)))
    const capped = Math.min(v, Math.max(0, MAX_TRAIT_TOTAL - total))
    points[key] = capped
    total += capped
  }
  return points
}

function sanitizeTeamArray(rawTeam) {
  if (!Array.isArray(rawTeam)) return []
  return rawTeam
    .filter((m) => m && POKEMON_BY_ID.has(m.id))
    .map((m) => ({
      id: m.id,
      megaForm: m.megaForm || 'base',
      role: m.role || '',
      nature: NATURE_BY_KEY.has(m.nature) ? m.nature : DEFAULT_NATURE,
      points: sanitizeTraitPoints(m.points),
      item: HELD_ITEM_BY_KEY.has(m.item) ? m.item : DEFAULT_ITEM,
    }))
    .slice(0, MAX_TEAM_SIZE)
}

function sanitizeOpponentArray(rawOpponent) {
  if (!Array.isArray(rawOpponent)) return []
  return rawOpponent
    .map((o) => (typeof o === 'string' ? { id: o, megaForm: 'base' } : o))
    .filter((o) => o && POKEMON_BY_ID.has(o.id))
    .map((o) => ({ id: o.id, megaForm: o.megaForm || 'base' }))
    .slice(0, MAX_TEAM_SIZE)
}

function loadState() {
  const fallback = { team: [], opponent: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    const rawTeam = Array.isArray(parsed) ? parsed : parsed?.team
    const rawOpponent = Array.isArray(parsed) ? [] : parsed?.opponent
    if (!Array.isArray(rawTeam)) return fallback
    return { team: sanitizeTeamArray(rawTeam), opponent: sanitizeOpponentArray(rawOpponent) }
  } catch {
    return fallback
  }
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadPresets(storageKey, sanitizeFn) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p) => p && typeof p.name === 'string' && Array.isArray(p.data))
      .map((p) => ({ id: p.id || genId(), name: p.name, data: sanitizeFn(p.data) }))
  } catch {
    return []
  }
}

function upsertPreset(presets, name, data) {
  const existing = presets.find((p) => p.name === name)
  if (existing) {
    return presets.map((p) => (p.name === name ? { ...p, data } : p))
  }
  return [...presets, { id: genId(), name, data }]
}

function natureModFor(natureKey, statKey) {
  const nature = NATURE_BY_KEY.get(natureKey)
  if (!nature) return 1
  if (nature.plus === statKey) return 1.1
  if (nature.minus === statKey) return 0.9
  return 1
}

// 포켓몬 챔피언스 룰: 레벨 50 고정, IV 31 고정을 전제로 미리 정리된 공식.
// HP = 종족값 + 75 + 특성치
// 그 외 스탯 = floor((종족값 + 20) × 성격보정) + 특성치
function calcStat({ base, points, isHp, natureMod }) {
  if (isHp) return base + 75 + points
  return Math.floor((base + 20) * natureMod) + points
}

// 종족값 + 성격 + 특성치를 반영한 레벨 50 실전 능력치 전체를 계산한다.
function computeRealStats(baseStats, nature, points) {
  const result = {}
  for (const s of STAT_META) {
    const isHp = s.key === 'hp'
    const mod = isHp ? 1 : natureModFor(nature, s.key)
    result[s.key] = calcStat({ base: baseStats[s.key], points: points[s.key], isHp, natureMod: mod })
  }
  return result
}

function getEffective(member) {
  const base = POKEMON_BY_ID.get(member.id)
  if (member.megaForm && member.megaForm !== 'base') {
    const megas = MEGA_EVOLUTIONS[base.dex] || []
    const variant = megas.find((v) => v.key === member.megaForm)
    if (variant) {
      return {
        name: variant.name,
        types: variant.types,
        stats: variant.stats,
        isMega: true,
        spriteId: variant.key,
      }
    }
  }
  return { name: base.name, types: base.types, stats: base.stats, isMega: false, spriteId: base.id }
}

// 도구가 능력치 배율 효과를 갖는 경우(구애 시리즈 등) 해당 스탯에 배율을 적용한다.
function applyItemToStats(stats, itemKey) {
  const item = HELD_ITEM_BY_KEY.get(itemKey)
  if (!item || !item.statKey) return stats
  return { ...stats, [item.statKey]: Math.floor(stats[item.statKey] * item.mult) }
}

// 종족값 폼(메가진화 포함)에 성격·특성치·도구 효과를 반영한 실전 능력치를 계산한다.
function getRealStats(member) {
  const eff = getEffective(member)
  const base = computeRealStats(eff.stats, member.nature, member.points)
  return applyItemToStats(base, member.item)
}

// 메가진화 폼 키에서 실제 게임 내 메가스톤 명칭(OOO나이트/나이트X/나이트Y)을 유도한다.
function megaStoneName(baseName, variantKey) {
  if (variantKey.endsWith('-mega-x')) return `${baseName}나이트X`
  if (variantKey.endsWith('-mega-y')) return `${baseName}나이트Y`
  return `${baseName}나이트`
}

function PokemonIcon({ name, types, size = 52, spriteId }) {
  const [imgError, setImgError] = useState(false)
  const c0 = TYPE_COLOR[types[0]]
  const c1 = types[1] ? TYPE_COLOR[types[1]] : shade(c0, -22)
  const showImage = Boolean(spriteId) && !imgError
  return (
    <div
      className="poke-icon"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(135deg, ${c0}, ${c1})`,
      }}
    >
      {showImage ? (
        <img
          className="poke-icon-img"
          src={`/sprites/${spriteId}.png`}
          alt={name}
          style={{ width: size * 0.82, height: size * 0.82 }}
          onError={() => setImgError(true)}
        />
      ) : (
        initialOf(name)
      )}
    </div>
  )
}

function TypeBadge({ type }) {
  return (
    <span className="type-badge" style={{ backgroundColor: TYPE_COLOR[type] }}>
      {TYPE_LABEL_KO[type]}
    </span>
  )
}

function LegalBadge({ legal }) {
  return (
    <span className={`legal-badge ${legal}`}>
      {legal === 'ok' ? '참전 OK' : '참전 확인'}
    </span>
  )
}

function Header({ theme, onToggleTheme }) {
  return (
    <div className="hero">
      <div className="hero-top-row">
        <div className="hero-kicker">
          <Sparkles size={14} /> POKE PARTY EDITOR
        </div>
        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          aria-label="다크/라이트 모드 전환"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? '라이트 모드' : '다크 모드'}
        </button>
      </div>
      <h1>포켓몬 챔피언스 파티 상성 분석기</h1>
      <p>
        강한 포켓몬 6마리를 모으는 것보다, 서로의 약점을 메워주는 조합을 짜는 게 더 중요합니다.
        타입 상성 · 스피드 순서 · 역할군 분배를 한 화면에서 확인하며 파티를 구성해보세요.
      </p>
      <div className="notice">
        <AlertTriangle size={16} />
        <span>
          포켓몬 챔피언스는 공식 API가 제공되지 않습니다. 타입/스피드 등 포켓몬 원본 데이터는
          PokeAPI 기준으로 정리했지만, 참전 표시(OK/확인)는 챔피언스 레귤레이션을 반영한 것이 아니라
          전설/환상의 포켓몬 여부로 나눈 참고용 구분입니다. 실제 레귤레이션은 반드시 게임 내에서
          다시 확인해주세요.
        </span>
      </div>
    </div>
  )
}

function PokemonPicker({ selectedIds, onToggle, maxSize }) {
  const [search, setSearch] = useState('')
  const [activeGens, setActiveGens] = useState(new Set())
  const [activeTypes, setActiveTypes] = useState(new Set())

  const isFull = maxSize != null && selectedIds.size >= maxSize

  const filtered = useMemo(() => {
    return POKEMON.filter((p) => {
      if (search.trim() && !p.name.includes(search.trim())) return false
      if (activeGens.size > 0 && !activeGens.has(generationOf(p.dex))) return false
      if (activeTypes.size > 0 && !p.types.some((t) => activeTypes.has(t))) return false
      return true
    })
  }, [search, activeGens, activeTypes])

  function toggleGen(gen) {
    setActiveGens((prev) => {
      const next = new Set(prev)
      if (next.has(gen)) next.delete(gen)
      else next.add(gen)
      return next
    })
  }

  function toggleType(type) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <>
      <div className="filters">
        <div className="filter-row">
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-faint)' }}
            />
            <input
              className="search-input"
              style={{ paddingLeft: 34, width: '100%' }}
              placeholder="이름으로 검색 (예: 리자몽)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="gen-chip-row">
          {GENERATIONS.map((gen) => {
            const active = activeGens.has(gen)
            return (
              <button
                key={gen}
                className={`gen-chip ${active ? 'active' : ''}`}
                onClick={() => toggleGen(gen)}
              >
                {gen}세대
              </button>
            )
          })}
          {activeGens.size > 0 && (
            <button className="reset-btn" onClick={() => setActiveGens(new Set())}>
              <RotateCcw size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
              초기화
            </button>
          )}
        </div>

        <div className="type-chip-row">
          {TYPES.map((t) => {
            const active = activeTypes.has(t)
            return (
              <button
                key={t}
                className={`type-chip ${active ? 'active' : ''}`}
                style={active ? { backgroundColor: TYPE_COLOR[t], borderColor: TYPE_COLOR[t] } : undefined}
                onClick={() => toggleType(t)}
              >
                {TYPE_LABEL_KO[t]}
              </button>
            )
          })}
          {activeTypes.size > 0 && (
            <button className="reset-btn" onClick={() => setActiveTypes(new Set())}>
              <RotateCcw size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="pokemon-scroll">
        {filtered.length === 0 ? (
          <div className="empty-msg">조건에 맞는 포켓몬이 없습니다.</div>
        ) : (
          <div className="pokemon-grid">
            {filtered.map((p) => {
              const selected = selectedIds.has(p.id)
              const disabled = !selected && isFull
              return (
                <div
                  key={p.id}
                  className={`poke-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                  onClick={() => !disabled && onToggle(p.id)}
                >
                  {selected && (
                    <span className="selected-check">
                      <Check size={13} />
                    </span>
                  )}
                  <PokemonIcon name={p.name} types={p.types} spriteId={p.id} />
                  <div className="poke-name">{p.name}</div>
                  <div className="poke-dex">No.{String(p.dex).padStart(4, '0')}</div>
                  <div className="badge-row">
                    {p.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <div className="badge-row">
                    <LegalBadge legal={p.legal} />
                    {canMegaEvolve(p) && <span className="mega-badge">메가 가능</span>}
                    {p.regionalForm === 'hisui' && <span className="hisui-badge">히스이 폼</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function PresetPanel({ label, presets, currentData, onSave, onLoad, onDelete }) {
  const [dialog, setDialog] = useState(null) // { type: 'save' | 'load' | 'delete', preset? }
  const [nameInput, setNameInput] = useState('')

  function openSaveDialog() {
    if (currentData.length === 0) return
    setNameInput('')
    setDialog({ type: 'save' })
  }

  function closeDialog() {
    setDialog(null)
  }

  function confirmDialog() {
    if (!dialog) return
    if (dialog.type === 'save') {
      const trimmed = nameInput.trim()
      if (!trimmed) return
      onSave(trimmed)
    } else if (dialog.type === 'load') {
      onLoad(dialog.preset)
    } else if (dialog.type === 'delete') {
      onDelete(dialog.preset.id)
    }
    setDialog(null)
  }

  return (
    <div className="preset-panel">
      <div className="preset-save-row">
        <button className="preset-save-btn" disabled={currentData.length === 0} onClick={openSaveDialog}>
          {label} 저장
        </button>
      </div>
      {presets.length > 0 && (
        <div className="preset-list">
          {presets.map((p) => (
            <div className="preset-chip" key={p.id}>
              <button className="preset-load-btn" onClick={() => setDialog({ type: 'load', preset: p })}>
                {p.name}
                <span className="preset-chip-count">({p.data.length}마리)</span>
              </button>
              <button className="preset-delete-btn" onClick={() => setDialog({ type: 'delete', preset: p })}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <div className="modal-overlay" onClick={closeDialog}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {dialog.type === 'save' && (
              <>
                <h3 className="modal-title">{label} 저장</h3>
                <p className="modal-message">저장할 {label} 이름을 입력하세요.</p>
                <input
                  className="search-input"
                  autoFocus
                  placeholder={`예: 레인팀`}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmDialog()}
                />
              </>
            )}
            {dialog.type === 'load' && (
              <>
                <h3 className="modal-title">프리셋 불러오기</h3>
                <p className="modal-message">
                  정말 "{dialog.preset.name}" 프리셋으로 현재 {label}를 변경하시겠습니까?
                </p>
              </>
            )}
            {dialog.type === 'delete' && (
              <>
                <h3 className="modal-title">프리셋 삭제</h3>
                <p className="modal-message">
                  정말 "{dialog.preset.name}" 프리셋을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </p>
              </>
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={closeDialog}>
                취소
              </button>
              <button
                className="modal-confirm-btn"
                disabled={dialog.type === 'save' && !nameInput.trim()}
                onClick={confirmDialog}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddPokemonSection({ team, onToggle }) {
  const teamIdSet = useMemo(() => new Set(team.map((m) => m.id)), [team])

  return (
    <section className="section">
      <div className="section-head">
        <span className="section-num">01</span>
        <h2>포켓몬 추가</h2>
      </div>
      <p className="section-sub">카드를 클릭하면 파티에 추가되고, 다시 클릭하면 제거됩니다.</p>
      <PokemonPicker selectedIds={teamIdSet} onToggle={onToggle} maxSize={MAX_TEAM_SIZE} />
    </section>
  )
}

function PartySection({
  team,
  onRemove,
  onRoleChange,
  presets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}) {
  const slots = [...team, ...Array(Math.max(0, MAX_TEAM_SIZE - team.length)).fill(null)]

  return (
    <section className="section">
      <div className="section-head">
        <span className="section-num">02</span>
        <h2>내 파티 ({team.length}/{MAX_TEAM_SIZE})</h2>
      </div>
      <PresetPanel
        label="파티"
        presets={presets}
        currentData={team}
        onSave={onSavePreset}
        onLoad={onLoadPreset}
        onDelete={onDeletePreset}
      />
      <div className="party-grid">
        {slots.map((member, idx) => {
          if (!member) {
            return (
              <div className="party-slot-empty" key={`empty-${idx}`}>
                <Users size={20} />
                빈 슬롯
              </div>
            )
          }
          const base = POKEMON_BY_ID.get(member.id)
          const eff = getEffective(member)
          const realStats = getRealStats(member)
          const isMegaEquipped = canMegaEvolve(base) && member.megaForm && member.megaForm !== 'base'
          const equippedItem = !isMegaEquipped ? HELD_ITEM_BY_KEY.get(member.item) : null
          return (
            <div className="party-card" key={member.id}>
              <button className="remove-btn" onClick={() => onRemove(member.id)}>
                <X size={13} />
              </button>
              <PokemonIcon name={eff.name} types={eff.types} size={56} spriteId={eff.spriteId} />
              <div className="poke-name">{eff.name}</div>
              <div className="badge-row">
                {eff.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </div>
              <LegalBadge legal={base.legal} />
              <div className="speed-only">
                <span className="speed-only-label">스피드</span>
                <span className="speed-only-value">{realStats.speed}</span>
              </div>

              {isMegaEquipped && (
                <div className="item-readonly-badge">
                  <Gem size={11} /> {megaStoneName(base.name, member.megaForm)} 장착 중
                </div>
              )}
              {equippedItem && (
                <div className="item-readonly-badge">
                  <Gem size={11} /> {equippedItem.name} 장착 중
                </div>
              )}

              <select
                className="select-field"
                value={member.role || ''}
                onChange={(e) => onRoleChange(member.id, e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function cellClass(mult) {
  if (mult === 4) return 'mult-4'
  if (mult === 2) return 'mult-2'
  if (mult === 0.5) return 'mult-half'
  if (mult === 0.25) return 'mult-quarter'
  if (mult === 0) return 'mult-zero'
  return ''
}

function cellLabel(mult) {
  if (mult === 4) return '×4'
  if (mult === 2) return '×2'
  if (mult === 0.5) return '×½'
  if (mult === 0.25) return '×¼'
  if (mult === 0) return '면역'
  return ''
}

function ThreatMatrixSection({ team }) {
  const effectiveTeam = useMemo(() => team.map((m) => ({ id: m.id, ...getEffective(m) })), [team])

  const weakCounts = useMemo(() => {
    const counts = {}
    TYPES.forEach((t) => {
      counts[t] = effectiveTeam.filter((m) => combinedMultiplier(t, m.types) > 1).length
    })
    return counts
  }, [effectiveTeam])

  const dangerTypes = TYPES.filter((t) => weakCounts[t] >= 3)

  if (effectiveTeam.length === 0) {
    return (
      <section className="section">
        <div className="section-head">
          <span className="section-num">03</span>
          <h2>위협 매트릭스</h2>
        </div>
        <p className="section-sub">파티에 포켓몬을 추가하면 타입 상성표가 여기에 표시됩니다.</p>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-head">
        <span className="section-num">03</span>
        <h2>위협 매트릭스</h2>
      </div>
      <p className="section-sub">각 셀은 해당 공격 타입이 그 포켓몬에게 들어갈 때의 배율입니다.</p>

      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="row-name" style={{ textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-elevated)' }}>
                파티원 \ 공격 타입
              </th>
              {TYPES.map((t) => (
                <th
                  key={t}
                  className={`type-col ${dangerTypes.includes(t) ? 'danger' : ''}`}
                  style={{ backgroundColor: TYPE_COLOR[t] }}
                >
                  {TYPE_LABEL_KO[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {effectiveTeam.map((m) => (
              <tr key={m.id}>
                <td className="row-name">{m.name}</td>
                {TYPES.map((t) => {
                  const mult = combinedMultiplier(t, m.types)
                  return (
                    <td key={t} className={cellClass(mult)}>
                      {cellLabel(mult)}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="sum-row">
              <td className="row-name">약점 인원 수</td>
              {TYPES.map((t) => (
                <td key={t} className={weakCounts[t] >= 3 ? 'mult-2' : ''}>
                  {weakCounts[t]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="legend">
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'rgba(229, 72, 77, 0.55)' }} /> 4배 약점
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'rgba(229, 72, 77, 0.22)' }} /> 2배 약점
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'rgba(69, 214, 196, 0.2)' }} /> 저항 (½ / ¼)
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'rgba(255,255,255,0.05)' }} /> 면역
          </span>
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: 'transparent', border: '1px solid var(--border)' }} /> 등배 (빈칸)
          </span>
        </div>
      </div>

      {dangerTypes.length > 0 ? (
        <div className="banner danger">
          <AlertTriangle size={16} />
          <span>
            {dangerTypes.map((t) => TYPE_LABEL_KO[t]).join(', ')} 타입에 3명 이상이 약점입니다.
            이 타입 하나로 파티 전체가 밀릴 수 있으니 저항 포켓몬이나 서브웨폰을 고려해보세요.
          </span>
        </div>
      ) : (
        <div className="banner success">
          <Check size={16} />
          <span>3명 이상이 동시에 약점인 타입이 없습니다. 균형이 안정적입니다.</span>
        </div>
      )}
    </section>
  )
}

function AceCoverSection({ team }) {
  const effectiveTeam = useMemo(
    () => team.map((m) => ({ id: m.id, role: m.role, ...getEffective(m) })),
    [team]
  )
  const aces = effectiveTeam.filter((m) => m.role === 'ace')

  if (team.length === 0) {
    return (
      <section className="section">
        <div className="section-head">
          <span className="section-num">04</span>
          <h2>에이스 커버 추천</h2>
        </div>
        <p className="section-sub">파티에 포켓몬을 추가하면 에이스 커버 추천이 여기에 표시됩니다.</p>
      </section>
    )
  }

  if (aces.length === 0) {
    return (
      <section className="section">
        <div className="section-head">
          <span className="section-num">04</span>
          <h2>에이스 커버 추천</h2>
        </div>
        <p className="section-sub">
          파티원 중 한 명을 <b>에이스</b> 역할로 지정하면, 그 포켓몬이 약점을 찔릴 때 반감·무효로
          받아줄 수 있는 파트너 타입을 추천해드립니다.
        </p>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-head">
        <span className="section-num">04</span>
        <h2>에이스 커버 추천</h2>
      </div>
      <p className="section-sub">
        에이스가 약점을 찔리는 공격 타입을 반감(½·¼)하거나 무효로 받을 수 있는 타입입니다.
        해당 타입을 가진 포켓몬을 에이스 옆에 두면 그 약점을 받아줄 수 있어요.
      </p>

      <div className="ace-cover-list">
        {aces.map((ace) => {
          const others = effectiveTeam.filter((m) => m.id !== ace.id)
          const weakTypes = TYPES.filter((t) => combinedMultiplier(t, ace.types) > 1)

          return (
            <div className="ace-cover-card" key={ace.id}>
              <div className="ace-cover-head">
                <PokemonIcon name={ace.name} types={ace.types} size={40} spriteId={ace.spriteId} />
                <div>
                  <div className="ace-cover-name">
                    <Sword size={13} /> {ace.name}
                  </div>
                  <div className="ace-cover-sub">약점 {weakTypes.length}개</div>
                </div>
              </div>

              {weakTypes.length === 0 ? (
                <div className="ace-cover-empty">약점 타입이 없습니다. 커버가 따로 필요 없어요.</div>
              ) : (
                <div className="ace-cover-rows">
                  {weakTypes.map((atkType) => {
                    const coverTypes = TYPES.map((defType) => ({
                      defType,
                      mult: getMultiplier(atkType, defType),
                    }))
                      .filter((c) => c.mult < 1)
                      .sort((a, b) => a.mult - b.mult)

                    const coveringMember = others.find(
                      (m) => combinedMultiplier(atkType, m.types) <= 0.5
                    )

                    return (
                      <div className="ace-cover-row" key={atkType}>
                        <span
                          className="ace-cover-atk-badge"
                          style={{ backgroundColor: TYPE_COLOR[atkType] }}
                        >
                          {TYPE_LABEL_KO[atkType]}
                        </span>
                        <div className="ace-cover-types">
                          {coverTypes.length === 0 ? (
                            <span className="ace-cover-none">추천 타입 없음</span>
                          ) : (
                            coverTypes.map((c) => (
                              <span
                                key={c.defType}
                                className="type-badge"
                                style={{ backgroundColor: TYPE_COLOR[c.defType] }}
                              >
                                {TYPE_LABEL_KO[c.defType]}
                                {c.mult === 0 ? ' 면역' : c.mult === 0.25 ? ' ¼' : ' ½'}
                              </span>
                            ))
                          )}
                        </div>
                        {coveringMember ? (
                          <span className="ace-cover-status ok">
                            <Check size={11} /> {coveringMember.name} 커버 중
                          </span>
                        ) : (
                          <span className="ace-cover-status missing">커버 없음</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SpeedTierSection({ team }) {
  const effectiveTeam = useMemo(
    () =>
      team
        .map((m) => ({ id: m.id, ...getEffective(m), speed: getRealStats(m).speed }))
        .sort((a, b) => b.speed - a.speed),
    [team]
  )

  if (effectiveTeam.length === 0) {
    return (
      <section className="section">
        <div className="section-head">
          <span className="section-num">05</span>
          <h2>스피드 층 확인</h2>
        </div>
        <p className="section-sub">파티에 포켓몬을 추가하면 스피드 순서가 여기에 표시됩니다.</p>
      </section>
    )
  }

  function tierOf(idx) {
    if (idx === 0) return { key: 'fast', label: '최속', color: 'var(--cyan)' }
    if (idx <= 2) return { key: 'mid', label: '중속', color: 'var(--violet)' }
    return { key: 'slow', label: '저속', color: 'var(--text-faint)' }
  }

  return (
    <section className="section">
      <div className="section-head">
        <span className="section-num">05</span>
        <h2>스피드 층 확인</h2>
      </div>
      <p className="section-sub">
        성격·특성치가 반영된 실전 스피드 내림차순 정렬입니다. 메가진화 폼이나 실전 능력치 계산기의
        설정을 바꾸면 즉시 반영됩니다.
      </p>

      <div className="speed-chart">
        {effectiveTeam.map((m, idx) => {
          const tier = tierOf(idx)
          const widthPct = Math.min(100, (m.speed / SPEED_SCALE_MAX) * 100)
          return (
            <div className="speed-row" key={m.id}>
              <div className="speed-label">
                <span className="speed-tier-dot" style={{ backgroundColor: tier.color }} />
                {m.name}
              </div>
              <div className="speed-track">
                <div
                  className="speed-fill"
                  style={{ width: `${widthPct}%`, backgroundColor: tier.color }}
                />
              </div>
              <div className="speed-value">{m.speed}</div>
            </div>
          )
        })}
      </div>

      <div className="tier-legend">
        <span><span className="speed-tier-dot" style={{ backgroundColor: 'var(--cyan)', display: 'inline-block', marginRight: 6 }} />최속 (1위)</span>
        <span><span className="speed-tier-dot" style={{ backgroundColor: 'var(--violet)', display: 'inline-block', marginRight: 6 }} />중속 (2~3위)</span>
        <span><span className="speed-tier-dot" style={{ backgroundColor: 'var(--text-faint)', display: 'inline-block', marginRight: 6 }} />저속 (그 외)</span>
      </div>
    </section>
  )
}

function RoleBalanceSection({ team }) {
  const counts = useMemo(() => {
    const c = { ace: 0, tank: 0, support: 0 }
    team.forEach((m) => {
      if (m.role && c[m.role] !== undefined) c[m.role] += 1
    })
    return c
  }, [team])

  return (
    <section className="section">
      <div className="section-head">
        <span className="section-num">06</span>
        <h2>역할군 밸런스</h2>
      </div>

      <div className="role-grid">
        {Object.entries(ROLE_META).map(([key, meta]) => {
          const Icon = meta.icon
          const count = counts[key]
          const warn = team.length > 0 && count === 0
          return (
            <div className={`role-card ${warn ? 'warn' : ''}`} key={key}>
              <Icon size={20} color={warn ? 'var(--amber)' : meta.color} />
              <div className="role-count" style={{ color: warn ? 'var(--amber)' : 'var(--text)' }}>
                {count}
              </div>
              <div className="role-name">{meta.label}</div>
            </div>
          )
        })}
      </div>

      <div className="footnote">
        <Info size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
        타입/스피드 데이터는 PokeAPI를 기반으로 정적으로 내장된 참고용 자료이며, 참전 여부(OK/확인)
        표시는 챔피언스 공식 API가 아닌 전설/환상의 포켓몬 여부로 나눈 참고용 구분입니다.
        실제 편성 전 게임 내 정보로 다시 확인하세요.
      </div>
    </section>
  )
}

function natureOptionLabel(n) {
  if (!n.plus) return `${n.name} (변화 없음)`
  const plusLabel = STAT_META.find((s) => s.key === n.plus)?.label
  const minusLabel = STAT_META.find((s) => s.key === n.minus)?.label
  return `${n.name} (${plusLabel}↑ ${minusLabel}↓)`
}

function StatCalculatorSection({ team, onPointsChange, onNatureChange, onItemChange }) {
  if (team.length === 0) {
    return (
      <section className="section">
        <div className="section-head">
          <span className="section-num">07</span>
          <h2>실전 능력치 계산기</h2>
        </div>
        <p className="section-sub">
          파티에 포켓몬을 추가하면 특성치·성격을 반영한 실전 능력치를 계산할 수 있습니다.
        </p>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-head">
        <span className="section-num">07</span>
        <h2>실전 능력치 계산기</h2>
      </div>
      <p className="section-sub">
        포켓몬 챔피언스 룰 기준(레벨 50 고정, 개체값 31 고정)입니다. 특성치와 성격을 조절하면
        실전 능력치가 즉시 반영됩니다.
      </p>

      <div className="level-row">
        <span className="level-badge">Lv.{BATTLE_LEVEL} 고정</span>
        <span className="level-badge">IV 31 고정</span>
      </div>

      <div className="trait-card-list">
        {team.map((member) => {
          const eff = getEffective(member)
          const pointTotal = Object.values(member.points).reduce((a, b) => a + b, 0)
          const base = POKEMON_BY_ID.get(member.id)
          const megas = canMegaEvolve(base) ? MEGA_EVOLUTIONS[base.dex] || [] : []

          return (
            <div className="trait-card" key={member.id}>
              <div className="trait-card-head">
                <PokemonIcon name={eff.name} types={eff.types} size={44} spriteId={eff.spriteId} />
                <div>
                  <div className="poke-name">{eff.name}</div>
                  <div className="badge-row">
                    {eff.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="trait-nature-row">
                <label>성격</label>
                <select
                  className="select-field"
                  value={member.nature}
                  onChange={(e) => onNatureChange(member.id, e.target.value)}
                >
                  {NATURES.map((n) => (
                    <option key={n.key} value={n.key}>
                      {natureOptionLabel(n)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="trait-nature-row">
                <label>
                  <Gem size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
                  도구
                </label>
                <select
                  className="select-field"
                  value={member.megaForm !== 'base' ? member.megaForm : member.item || 'none'}
                  onChange={(e) => onItemChange(member.id, e.target.value)}
                >
                  <option value="none">없음</option>
                  {megas.length > 0 && (
                    <optgroup label="메가스톤">
                      {megas.map((m) => (
                        <option key={m.key} value={m.key}>
                          {megaStoneName(base.name, m.key)} ({m.name})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="능력치 변화 도구">
                    {HELD_ITEMS.filter((it) => it.statKey).map((it) => (
                      <option key={it.key} value={it.key}>
                        {it.name} ({it.note})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="기타 도구">
                    {HELD_ITEMS.filter((it) => !it.statKey).map((it) => (
                      <option key={it.key} value={it.key}>
                        {it.name} ({it.note})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className={`trait-total ${pointTotal >= MAX_TRAIT_TOTAL ? 'full' : ''}`}>
                특성치 합계 {pointTotal} / {MAX_TRAIT_TOTAL}
              </div>

              <div className="trait-grid">
                {STAT_META.map((s) => (
                  <div className="trait-field" key={s.key}>
                    <label>{s.label}</label>
                    <input
                      type="number"
                      className="trait-input"
                      min={0}
                      max={MAX_TRAIT_PER_STAT}
                      value={member.points[s.key] === 0 ? '' : member.points[s.key]}
                      onChange={(e) => onPointsChange(member.id, s.key, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="stat-block computed-stat-block">
                {STAT_META.map((s) => {
                  const isHp = s.key === 'hp'
                  const mod = isHp ? 1 : natureModFor(member.nature, s.key)
                  let value = calcStat({
                    base: eff.stats[s.key],
                    points: member.points[s.key],
                    isHp,
                    natureMod: mod,
                  })
                  const activeItem = HELD_ITEM_BY_KEY.get(member.item)
                  const isItemBoosted = activeItem?.statKey === s.key
                  if (isItemBoosted) value = Math.floor(value * activeItem.mult)
                  const widthPct = Math.min(100, (value / COMPUTED_STAT_SCALE_MAX) * 100)
                  return (
                    <div className="stat-row" key={s.key}>
                      <span className="stat-row-label">
                        {s.label}
                        {mod > 1 && <span className="nature-arrow up">▲</span>}
                        {mod < 1 && <span className="nature-arrow down">▼</span>}
                        {isItemBoosted && <span className="item-arrow">🔧</span>}
                      </span>
                      <div className="stat-row-track">
                        <div
                          className="stat-row-fill"
                          style={{ width: `${widthPct}%`, backgroundColor: s.color }}
                        />
                      </div>
                      <span className="stat-row-value">{value}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="footnote">
        <Info size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
        레벨 50 · 개체값(IV) 31 고정, 특성치는 스탯당 최대 {MAX_TRAIT_PER_STAT} · 전 스탯 합산 최대{' '}
        {MAX_TRAIT_TOTAL} 기준으로 계산합니다. 실제 게임 내 수치와 미세한 차이가 있을 수 있으니
        참고용으로 활용하세요.
      </div>
    </section>
  )
}

function scoreCellClass(score) {
  if (score >= 1.5) return 'mult-4'
  if (score > 0) return 'mult-half'
  if (score <= -1.5) return 'mult-2'
  if (score < 0) return 'mult-quarter'
  return ''
}

function multLabel(mult) {
  if (mult === 0) return '0배(면역)'
  if (mult === 0.25) return '0.25배'
  if (mult === 0.5) return '0.5배'
  if (mult === 1) return '1배(등배)'
  return `${mult}배`
}

function bestAttackType(attackerTypes, defenderTypes) {
  let bestType = attackerTypes[0]
  let bestMult = -Infinity
  for (const t of attackerTypes) {
    const mult = combinedMultiplier(t, defenderTypes)
    if (mult > bestMult) {
      bestMult = mult
      bestType = t
    }
  }
  return { type: bestType, mult: bestMult }
}

// 자속기(같은 타입 공격) 가정 하의 단순 상성 매치업 상세치.
function matchupDetail(myTypes, oppTypes) {
  const myAtk = bestAttackType(myTypes, oppTypes)
  const oppAtk = bestAttackType(oppTypes, myTypes)
  return {
    score: myAtk.mult - oppAtk.mult,
    myAtkType: myAtk.type,
    myAtkMult: myAtk.mult,
    oppAtkType: oppAtk.type,
    oppAtkMult: oppAtk.mult,
  }
}

function buildReason(me) {
  if (me.perOpp.length === 0) return ''
  const sorted = [...me.perOpp].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  const bestSentence = `${TYPE_LABEL_KO[best.myAtkType]} 타입으로 ${best.oppName}에게 ${multLabel(best.myAtkMult)} 피해를 줄 수 있어 가장 유리`
  if (worst.oppId === best.oppId || worst.score >= 0) {
    return `${bestSentence}합니다.`
  }
  const worstSentence = `${worst.oppName}의 ${TYPE_LABEL_KO[worst.oppAtkType]} 공격에는 ${multLabel(worst.oppAtkMult)}를 맞아 가장 조심해야 합니다`
  return `${bestSentence}하고, ${worstSentence}.`
}

const GEMINI_KEY_STORAGE = 'poke-party-editor:gemini-key'
const GEMINI_MODEL = 'gemini-2.5-flash'

function maskKey(key) {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

const ROLE_LABEL = { ace: '에이스', tank: '탱커', support: '서포터', '': '미지정' }

function statsLine(stats) {
  return `HP${stats.hp}/공격${stats.attack}/방어${stats.defense}/특공${stats.spAttack}/특방${stats.spDefense}/스피드${stats.speed}`
}

// 팀 내 2마리 이상이 함께 약점을 지니는 타입을 뽑아 AI에게 팀 구조 정보로 제공한다.
function computeSharedWeaknesses(effectiveList) {
  const counts = {}
  TYPES.forEach((t) => {
    counts[t] = effectiveList.filter((m) => combinedMultiplier(t, m.types) > 1).length
  })
  return TYPES.filter((t) => counts[t] >= 2)
    .sort((a, b) => counts[b] - counts[a])
    .map((t) => `${TYPE_LABEL_KO[t]}(${counts[t]}마리 약점)`)
}

function buildGeminiPrompt(scored, oppEffective, pickCount, formatKey, formatLabel) {
  const sharedWeaknesses = computeSharedWeaknesses(scored)
  const teamDesc = scored
    .map((m, i) => {
      const natureName = NATURE_BY_KEY.get(m.nature)?.name || m.nature
      const itemName = HELD_ITEM_BY_KEY.get(m.item)?.name || '없음'
      return `${i + 1}. ${m.name} [역할: ${ROLE_LABEL[m.role] ?? '미지정'}] (타입: ${m.types
        .map((t) => TYPE_LABEL_KO[t])
        .join('/')}, 성격: ${natureName}, 도구: ${itemName}, 실전 능력치: ${statsLine(m.realStats)}, 상대 팀 대비 평균 상성 점수: ${m.avg.toFixed(2)})`
    })
    .join('\n')
  const oppDesc = oppEffective
    .map(
      (o) =>
        `- ${o.name} (타입: ${o.types.map((t) => TYPE_LABEL_KO[t]).join('/')}, 종족값 기준 스탯: ${statsLine(o.stats)})`
    )
    .join('\n')

  const formatGuideline =
    formatKey === 'double'
      ? '이번 배틀은 더블배틀이야. 스프레드 기술(양쪽 동시 공격)로 상대 둘을 한 번에 압박할 수 있는지, 필드 서포트(트릭룸·순풍 등 스피드 조작이나 도와줘·상대 견제 같은 리다이렉션)를 맡을 포켓몬이 있는지, 지진 같은 스프레드 기술이 아군을 오폭하지는 않는지, 에이스·탱커·서포터가 짝을 이뤄 함께 필드에 나갈 수 있는 조합인지를 중점적으로 판단해줘.'
      : '이번 배틀은 싱글배틀이야. 상대를 상대로 순차적으로 교체하며 대응할 수 있는지, 스텔스록 등 설치/제거 역할이 있는지, 벽부수기(월브레이커)와 마무리(스위퍼) 역할이 잘 나뉘어 있는지, 상대 에이스를 견제하고 역관광(리벤지킬)할 수 있는 스피드·화력을 가진 포켓몬이 있는지를 중점적으로 판단해줘.'

  return `너는 포켓몬 챔피언스(Pokémon Champions) 공식 룰을 정확히 아는 전문 대전 코치야.
포켓몬 챔피언스는 기존 시리즈와 달리 레벨 50 고정, 개체값(IV) 항상 31, 노력치 대신 스탯당 최대 32·총합 최대 66의 "특성치" 시스템을 쓴다는 걸 반드시 감안해줘.

${formatGuideline}

아래 데이터를 바탕으로, 내 파티 ${scored.length}마리 중 ${pickCount}마리를 선출한다면 어떤 조합이 가장 좋을지 실전 관점에서 판단해줘. 단순 타입 상성 점수뿐 아니라 역할 분배(에이스/탱커/서포터), 실전 능력치(스피드 순서 포함), 팀 전체가 공유하는 약점 유무까지 종합적으로 고려해줘.

[내 파티 상세]
${teamDesc}
${sharedWeaknesses.length > 0 ? `\n[팀 전체가 공유하는 약점 타입]\n${sharedWeaknesses.join(', ')}\n` : ''}
[상대 팀 예상 구성]
${oppDesc}

다음 형식의 한국어로, 실전에 바로 참고할 수 있게 답변해줘 (전체 6~10문장 정도, 과도하게 길게 쓰지 말 것):
1. 추천 선출 조합: 포켓몬 이름을 ${pickCount}마리 콕 집어서 나열
2. 선정 이유: 왜 이 조합이 다른 조합보다 나은지 상성·역할·스피드 관점에서 2~3문장으로 설명
3. 실전 운영 팁: ${formatLabel}에서 이 조합을 어떻게 운용하면 좋을지(선출 순서, 주의할 상대 등) 2~3문장으로 설명`
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new Error(errBody?.error?.message || `요청 실패 (HTTP ${res.status})`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  if (!text) throw new Error('AI 응답을 받지 못했습니다.')
  return text
}

function PickAdvisorPage({
  team,
  opponent,
  onToggleOpponent,
  onRemoveOpponent,
  onOpponentFormChange,
  opponentPresets,
  onSaveOpponentPreset,
  onLoadOpponentPreset,
  onDeleteOpponentPreset,
}) {
  const [battleFormat, setBattleFormat] = useState('double')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '')
  const [editingKey, setEditingKey] = useState(() => !localStorage.getItem(GEMINI_KEY_STORAGE))
  const [aiState, setAiState] = useState({ status: 'idle', text: '', error: '' })
  const opponentIdSet = useMemo(() => new Set(opponent.map((o) => o.id)), [opponent])

  useEffect(() => {
    localStorage.setItem(GEMINI_KEY_STORAGE, apiKey)
  }, [apiKey])

  const myList = useMemo(
    () =>
      team.map((m) => {
        const eff = getEffective(m)
        return {
          id: m.id,
          ...eff,
          role: m.role,
          nature: m.nature,
          item: m.item,
          realStats: applyItemToStats(computeRealStats(eff.stats, m.nature, m.points), m.item),
        }
      }),
    [team]
  )
  const oppList = useMemo(
    () => opponent.map((o) => ({ ...o, base: POKEMON_BY_ID.get(o.id) })).filter((o) => o.base),
    [opponent]
  )
  const oppEffective = useMemo(
    () => oppList.map((o) => ({ id: o.id, ...getEffective(o) })),
    [oppList]
  )

  const selectedFormat = BATTLE_FORMATS.find((f) => f.key === battleFormat) || BATTLE_FORMATS[1]
  const effectivePickCount = Math.max(1, Math.min(selectedFormat.count, myList.length || 1))

  const scored = useMemo(() => {
    return myList
      .map((me) => {
        const perOpp = oppEffective.map((opp) => ({
          oppId: opp.id,
          oppName: opp.name,
          ...matchupDetail(me.types, opp.types),
        }))
        const avg = perOpp.length ? perOpp.reduce((s, p) => s + p.score, 0) / perOpp.length : 0
        return { ...me, perOpp, avg, reason: buildReason({ ...me, perOpp }) }
      })
      .sort((a, b) => b.avg - a.avg)
  }, [myList, oppEffective])

  const recommended = new Set(scored.slice(0, effectivePickCount).map((m) => m.id))

  async function handleRequestAi() {
    setAiState({ status: 'loading', text: '', error: '' })
    try {
      const prompt = buildGeminiPrompt(
        scored,
        oppEffective,
        effectivePickCount,
        selectedFormat.key,
        selectedFormat.label
      )
      const text = await callGemini(apiKey, prompt)
      setAiState({ status: 'done', text, error: '' })
    } catch (err) {
      setAiState({ status: 'error', text: '', error: err.message || 'AI 평가 요청에 실패했습니다.' })
    }
  }

  return (
    <div>
      <section className="section">
        <div className="section-head">
          <span className="section-num">01</span>
          <h2>상대 팀 구성</h2>
        </div>
        <p className="section-sub">
          상대가 낼 것으로 예상되는 포켓몬을 최대 {MAX_TEAM_SIZE}마리까지 선택하세요.
        </p>
        <PresetPanel
          label="상대 팀"
          presets={opponentPresets}
          currentData={opponent}
          onSave={onSaveOpponentPreset}
          onLoad={onLoadOpponentPreset}
          onDelete={onDeleteOpponentPreset}
        />
        <PokemonPicker
          selectedIds={opponentIdSet}
          onToggle={onToggleOpponent}
          maxSize={MAX_TEAM_SIZE}
        />
      </section>

      {oppList.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="section-num">02</span>
            <h2>상대 파티 ({oppList.length}/{MAX_TEAM_SIZE})</h2>
          </div>
          <div className="party-grid">
            {oppList.map((o) => {
              const eff = getEffective(o)
              const megas = canMegaEvolve(o.base) ? MEGA_EVOLUTIONS[o.base.dex] || [] : []
              return (
                <div className="party-card" key={o.id}>
                  <button className="remove-btn" onClick={() => onRemoveOpponent(o.id)}>
                    <X size={13} />
                  </button>
                  <PokemonIcon name={eff.name} types={eff.types} size={56} spriteId={eff.spriteId} />
                  <div className="poke-name">{eff.name}</div>
                  <div className="badge-row">
                    {eff.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <LegalBadge legal={o.base.legal} />
                  <div className="speed-only">
                    <span className="speed-only-label">스피드</span>
                    <span className="speed-only-value">{eff.stats.speed}</span>
                  </div>
                  {megas.length > 0 && (
                    <select
                      className="select-field"
                      value={o.megaForm || 'base'}
                      onChange={(e) => onOpponentFormChange(o.id, e.target.value)}
                    >
                      <option value="base">{o.base.name} (기본 폼)</option>
                      {megas.map((mg) => (
                        <option key={mg.key} value={mg.key}>
                          {mg.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <span className="section-num">03</span>
          <h2>선출 추천</h2>
        </div>

        {team.length === 0 ? (
          <p className="section-sub">먼저 파티 빌더에서 내 파티를 구성해주세요.</p>
        ) : oppList.length === 0 ? (
          <p className="section-sub">위에서 상대 팀 포켓몬을 1마리 이상 선택하면 추천 결과가 표시됩니다.</p>
        ) : (
          <>
            <p className="section-sub">
              내 파티가 상대 팀 각각에게 얼마나 유리한지(자속기 기준 공격 배율 − 피격 배율)를
              계산해 점수가 높은 순으로 정렬했습니다.
            </p>

            <div className="pick-count-row">
              <label>배틀 방식</label>
              <div className="format-toggle">
                {BATTLE_FORMATS.map((f) => (
                  <button
                    key={f.key}
                    className={`format-toggle-btn ${battleFormat === f.key ? 'active' : ''}`}
                    onClick={() => setBattleFormat(f.key)}
                  >
                    {f.label} ({Math.min(f.count, myList.length || f.count)}마리)
                  </button>
                ))}
              </div>
            </div>

            <div className="advisor-rank-list">
              {scored.map((m, idx) => (
                <div className={`advisor-rank-card ${recommended.has(m.id) ? 'recommended' : ''}`} key={m.id}>
                  <div className="advisor-rank-num">{idx + 1}</div>
                  <PokemonIcon name={m.name} types={m.types} size={40} spriteId={m.spriteId} />
                  <div className="advisor-rank-info">
                    <div className="poke-name">{m.name}</div>
                    <div className="badge-row">
                      {m.types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                    <div className="advisor-reason">{m.reason}</div>
                  </div>
                  <div className="advisor-rank-score">
                    <span className={m.avg > 0 ? 'score-pos' : m.avg < 0 ? 'score-neg' : 'score-neutral'}>
                      {m.avg > 0 ? '+' : ''}
                      {m.avg.toFixed(2)}
                    </span>
                    {recommended.has(m.id) && <span className="recommended-tag">추천 선출</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="matrix-wrap" style={{ marginTop: 16 }}>
              <table className="matrix">
                <thead>
                  <tr>
                    <th
                      className="row-name"
                      style={{
                        textAlign: 'left',
                        position: 'sticky',
                        left: 0,
                        background: 'var(--bg-elevated)',
                      }}
                    >
                      내 파티 \ 상대
                    </th>
                    {oppEffective.map((opp) => (
                      <th key={opp.id} className="type-col" style={{ backgroundColor: TYPE_COLOR[opp.types[0]] }}>
                        {opp.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scored.map((m) => {
                    const bestScoreInRow = Math.max(...m.perOpp.map((p) => p.score))
                    return (
                      <tr key={m.id}>
                        <td className="row-name">{m.name}</td>
                        {m.perOpp.map((p) => (
                          <td key={p.oppId} className={scoreCellClass(p.score)}>
                            {p.score > 0 ? '+' : ''}
                            {p.score.toFixed(1)}
                            {p.score === bestScoreInRow && p.score > 0 ? ' ★' : ''}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="legend">
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: 'rgba(229, 72, 77, 0.55)' }} /> 매우 유리
                  (+1.5 이상)
                </span>
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: 'rgba(69, 214, 196, 0.1)' }} /> 유리
                </span>
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: 'rgba(69, 214, 196, 0.2)' }} /> 불리
                </span>
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: 'rgba(229, 72, 77, 0.22)' }} /> 매우 불리
                  (-1.5 이하)
                </span>
              </div>
            </div>

            <div className="footnote">
              <Info size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
              점수는 두 포켓몬의 자속(같은 타입) 공격을 가정한 단순 타입 상성 계산이며, 실제 기술 구성·특성·
              능력치 차이는 반영하지 않은 참고용 지표입니다.
            </div>
          </>
        )}
      </section>

      {scored.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="section-num">04</span>
            <h2>AI 평가 (선택)</h2>
          </div>
          <p className="section-sub">
            Gemini API 키를 입력하면 위 상성 계산을 바탕으로 자연어 전략 코멘트를 받아볼 수 있습니다.
            키는 이 브라우저에만 저장되어 구글로만 직접 전송되며, 호출량에 따라 구글의 Gemini API
            요금이 별도로 청구될 수 있습니다.
          </p>
          {apiKey && !editingKey ? (
            <div className="ai-key-saved-row">
              <span className="ai-key-saved-badge">
                <Check size={13} /> 저장된 키 사용 중 ({maskKey(apiKey)})
              </span>
              <button className="ai-key-change-btn" onClick={() => setEditingKey(true)}>
                키 변경
              </button>
              <button
                className="ai-eval-btn"
                disabled={aiState.status === 'loading'}
                onClick={handleRequestAi}
              >
                {aiState.status === 'loading' ? '평가 중...' : 'AI 평가 요청'}
              </button>
            </div>
          ) : (
            <div className="ai-key-row">
              <input
                type="password"
                className="search-input"
                placeholder="Gemini API 키 붙여넣기"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && setEditingKey(false)}
                autoFocus={editingKey && Boolean(apiKey)}
              />
              <button
                className="ai-eval-btn"
                disabled={!apiKey.trim()}
                onClick={() => setEditingKey(false)}
              >
                키 저장
              </button>
            </div>
          )}

          {aiState.status === 'error' && (
            <div className="banner danger" style={{ marginTop: 12 }}>
              <AlertTriangle size={16} />
              <span>{aiState.error}</span>
            </div>
          )}

          {aiState.status === 'done' && (
            <div className="ai-result">
              {aiState.text
                .split('\n')
                .filter((line) => line.trim())
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('builder')
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'dark')
  const [team, setTeam] = useState(() => loadState().team)
  const [opponent, setOpponent] = useState(() => loadState().opponent)
  const [teamPresets, setTeamPresets] = useState(() => loadPresets(TEAM_PRESETS_KEY, sanitizeTeamArray))
  const [opponentPresets, setOpponentPresets] = useState(() =>
    loadPresets(OPPONENT_PRESETS_KEY, sanitizeOpponentArray)
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ team, opponent }))
  }, [team, opponent])

  useEffect(() => {
    localStorage.setItem(TEAM_PRESETS_KEY, JSON.stringify(teamPresets))
  }, [teamPresets])

  useEffect(() => {
    localStorage.setItem(OPPONENT_PRESETS_KEY, JSON.stringify(opponentPresets))
  }, [opponentPresets])

  function saveTeamPreset(name) {
    setTeamPresets((prev) => upsertPreset(prev, name, team))
  }

  function loadTeamPreset(preset) {
    setTeam(preset.data)
  }

  function deleteTeamPreset(id) {
    setTeamPresets((prev) => prev.filter((p) => p.id !== id))
  }

  function saveOpponentPreset(name) {
    setOpponentPresets((prev) => upsertPreset(prev, name, opponent))
  }

  function loadOpponentPreset(preset) {
    setOpponent(preset.data)
  }

  function deleteOpponentPreset(id) {
    setOpponentPresets((prev) => prev.filter((p) => p.id !== id))
  }

  function toggleOpponent(id) {
    setOpponent((prev) => {
      if (prev.some((o) => o.id === id)) return prev.filter((o) => o.id !== id)
      if (prev.length >= MAX_TEAM_SIZE) return prev
      return [...prev, { id, megaForm: 'base' }]
    })
  }

  function removeOpponent(id) {
    setOpponent((prev) => prev.filter((o) => o.id !== id))
  }

  function updateOpponentForm(id, megaForm) {
    setOpponent((prev) => prev.map((o) => (o.id === id ? { ...o, megaForm } : o)))
  }

  function toggleMember(id) {
    setTeam((prev) => {
      if (prev.some((m) => m.id === id)) {
        return prev.filter((m) => m.id !== id)
      }
      if (prev.length >= MAX_TEAM_SIZE) return prev
      return [
        ...prev,
        {
          id,
          megaForm: 'base',
          role: '',
          nature: DEFAULT_NATURE,
          points: emptyTraitPoints(),
          item: DEFAULT_ITEM,
        },
      ]
    })
  }

  function removeMember(id) {
    setTeam((prev) => prev.filter((m) => m.id !== id))
  }

  // 도구 선택창은 메가스톤과 일반 도구를 한 슬롯에서 고른다. 메가스톤을 고르면 megaForm이
  // 바뀌고 다른 도구는 해제되며, 일반 도구를 고르면 반대로 폼이 기본형으로 돌아간다.
  function updateItem(id, value) {
    setTeam((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        if (ALL_MEGA_KEYS.has(value)) return { ...m, megaForm: value, item: DEFAULT_ITEM }
        if (value === 'none') return { ...m, megaForm: 'base', item: DEFAULT_ITEM }
        return { ...m, megaForm: 'base', item: value }
      })
    )
  }

  function updateRole(id, role) {
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)))
  }

  function updateNature(id, nature) {
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, nature } : m)))
  }

  function updatePoints(id, statKey, rawValue) {
    setTeam((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        const value = Math.max(0, Math.min(MAX_TRAIT_PER_STAT, Math.floor(Number(rawValue) || 0)))
        const otherTotal = Object.entries(m.points).reduce(
          (sum, [k, v]) => (k === statKey ? sum : sum + v),
          0
        )
        const capped = Math.min(value, Math.max(0, MAX_TRAIT_TOTAL - otherTotal))
        return { ...m, points: { ...m.points, [statKey]: capped } }
      })
    )
  }

  return (
    <div className="app">
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <div className="page-nav">
        <button
          className={`page-nav-btn ${page === 'builder' ? 'active' : ''}`}
          onClick={() => setPage('builder')}
        >
          파티 빌더
        </button>
        <button
          className={`page-nav-btn ${page === 'advisor' ? 'active' : ''}`}
          onClick={() => setPage('advisor')}
        >
          선출 추천
        </button>
      </div>

      {page === 'builder' ? (
        <>
          <AddPokemonSection team={team} onToggle={toggleMember} />
          <PartySection
            team={team}
            onRemove={removeMember}
            onRoleChange={updateRole}
            presets={teamPresets}
            onSavePreset={saveTeamPreset}
            onLoadPreset={loadTeamPreset}
            onDeletePreset={deleteTeamPreset}
          />
          <ThreatMatrixSection team={team} />
          <AceCoverSection team={team} />
          <SpeedTierSection team={team} />
          <RoleBalanceSection team={team} />
          <StatCalculatorSection
            team={team}
            onPointsChange={updatePoints}
            onNatureChange={updateNature}
            onItemChange={updateItem}
          />
        </>
      ) : (
        <PickAdvisorPage
          team={team}
          opponent={opponent}
          onToggleOpponent={toggleOpponent}
          onRemoveOpponent={removeOpponent}
          onOpponentFormChange={updateOpponentForm}
          opponentPresets={opponentPresets}
          onSaveOpponentPreset={saveOpponentPreset}
          onLoadOpponentPreset={loadOpponentPreset}
          onDeleteOpponentPreset={deleteOpponentPreset}
        />
      )}
    </div>
  )
}
