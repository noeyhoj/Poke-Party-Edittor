// 25개 성격 데이터. PokeAPI(https://pokeapi.co)에서 자동 생성되었습니다.
// plus/minus: null이면 변화 없는 무성격(중립) 성격
export const NATURES = [
  { key: 'hardy', name: '노력', plus: null, minus: null },
  { key: 'lonely', name: '외로움', plus: 'attack', minus: 'defense' },
  { key: 'brave', name: '용감', plus: 'attack', minus: 'speed' },
  { key: 'adamant', name: '고집', plus: 'attack', minus: 'spAttack' },
  { key: 'naughty', name: '개구쟁이', plus: 'attack', minus: 'spDefense' },
  { key: 'bold', name: '대담', plus: 'defense', minus: 'attack' },
  { key: 'docile', name: '온순', plus: null, minus: null },
  { key: 'relaxed', name: '무사태평', plus: 'defense', minus: 'speed' },
  { key: 'impish', name: '장난꾸러기', plus: 'defense', minus: 'spAttack' },
  { key: 'lax', name: '촐랑', plus: 'defense', minus: 'spDefense' },
  { key: 'timid', name: '겁쟁이', plus: 'speed', minus: 'attack' },
  { key: 'hasty', name: '성급', plus: 'speed', minus: 'defense' },
  { key: 'serious', name: '성실', plus: null, minus: null },
  { key: 'jolly', name: '명랑', plus: 'speed', minus: 'spAttack' },
  { key: 'naive', name: '천진난만', plus: 'speed', minus: 'spDefense' },
  { key: 'modest', name: '조심', plus: 'spAttack', minus: 'attack' },
  { key: 'mild', name: '의젓', plus: 'spAttack', minus: 'defense' },
  { key: 'quiet', name: '냉정', plus: 'spAttack', minus: 'speed' },
  { key: 'bashful', name: '수줍음', plus: null, minus: null },
  { key: 'rash', name: '덜렁', plus: 'spAttack', minus: 'spDefense' },
  { key: 'calm', name: '차분', plus: 'spDefense', minus: 'attack' },
  { key: 'gentle', name: '얌전', plus: 'spDefense', minus: 'defense' },
  { key: 'sassy', name: '건방', plus: 'spDefense', minus: 'speed' },
  { key: 'careful', name: '신중', plus: 'spDefense', minus: 'spAttack' },
  { key: 'quirky', name: '변덕', plus: null, minus: null },
]

export const NATURE_BY_KEY = new Map(NATURES.map((n) => [n.key, n]))
