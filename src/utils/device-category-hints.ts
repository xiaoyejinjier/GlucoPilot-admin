/** 与后端 DeviceCategoryHints 对齐的本地启发式（仅用于编辑弹窗预填）。 */

const SN_PREFIXES: Array<{ prefix: string; category: string }> = [
  { prefix: 'LIBRE', category: 'CGM' },
  { prefix: 'CGM', category: 'CGM' },
  { prefix: 'DEXCOM', category: 'CGM' },
  { prefix: 'GUARDIAN', category: 'CGM' },
  { prefix: 'BGM', category: 'BGM' },
  { prefix: 'ACCUS', category: 'BGM' },
  { prefix: 'ONETOUCH', category: 'BGM' },
  { prefix: 'PUMP', category: 'PUMP' },
  { prefix: 'OMNIPOD', category: 'PUMP' },
  { prefix: 'PEN', category: 'PEN' },
  { prefix: 'BAND', category: 'BAND' },
  { prefix: 'WATCH', category: 'WATCH' },
  { prefix: 'RING', category: 'RING' },
  { prefix: 'HUB', category: 'HUB' },
  { prefix: 'SCALE', category: 'SCALE' },
  { prefix: 'BP', category: 'BP' },
  { prefix: 'SPO2', category: 'OXIMETER' },
  { prefix: 'OXIM', category: 'OXIMETER' }
]

const KEYWORDS: Array<{ needle: string; category: string }> = [
  { needle: 'LIBRE', category: 'CGM' },
  { needle: 'CGM', category: 'CGM' },
  { needle: '连续血糖', category: 'CGM' },
  { needle: '动态血糖', category: 'CGM' },
  { needle: 'DEXCOM', category: 'CGM' },
  { needle: 'BGM', category: 'BGM' },
  { needle: '血糖仪', category: 'BGM' },
  { needle: '指尖', category: 'BGM' },
  { needle: '胰岛素泵', category: 'PUMP' },
  { needle: 'PUMP', category: 'PUMP' },
  { needle: '胰岛素笔', category: 'PEN' },
  { needle: '手环', category: 'BAND' },
  { needle: 'BAND', category: 'BAND' },
  { needle: '手表', category: 'WATCH' },
  { needle: 'WATCH', category: 'WATCH' },
  { needle: '戒指', category: 'RING' },
  { needle: 'RING', category: 'RING' },
  { needle: '网关', category: 'HUB' },
  { needle: 'HUB', category: 'HUB' },
  { needle: '体脂秤', category: 'SCALE' },
  { needle: '体重秤', category: 'SCALE' },
  { needle: 'SCALE', category: 'SCALE' },
  { needle: '血压', category: 'BP' },
  { needle: '血氧', category: 'OXIMETER' },
  { needle: 'OXIMETER', category: 'OXIMETER' }
]

export function suggestDeviceCategory(
  deviceSn?: string,
  deviceName?: string,
  deviceModel?: string
): string | null {
  const sn = (deviceSn || '').trim().toUpperCase()
  if (sn) {
    for (const rule of SN_PREFIXES) {
      if (sn.startsWith(rule.prefix)) return rule.category
    }
  }
  const haystack = [deviceName, deviceModel].filter(Boolean).join(' ').trim()
  if (!haystack) return null
  const upper = haystack.toUpperCase()
  for (const rule of KEYWORDS) {
    if (upper.includes(rule.needle.toUpperCase())) return rule.category
  }
  return null
}
