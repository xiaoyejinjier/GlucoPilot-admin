/**
 * 行级 diff（不引第三方依赖）：LCS 求最长公共子序列，再回溯出 same/add/del 三类行。
 * 只用于管理端"改了什么"的可视化，不追求最小编辑脚本的严格最优。
 */

/** 超过这个行数就退化成"只标新增行"，避免 O(n*m) 的 LCS 把页面卡住 */
export const DIFF_LCS_LINE_LIMIT = 400

export interface DiffLine {
  type: 'same' | 'add' | 'del'
  text: string
}

function splitLines(text: string): string[] {
  // 空正文按"零行"处理（''.split('\n') 会得到 ['']，否则会和空串比出多余的一条删除行）
  if (!text) return []
  // 提示词里 CRLF 很常见，先统一再按行切，避免整篇被判成"全变了"
  return text.replace(/\r\n/g, '\n').split('\n')
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  if (!oldText && !newText) return []
  const a = splitLines(oldText)
  const b = splitLines(newText)

  if (a.length > DIFF_LCS_LINE_LIMIT || b.length > DIFF_LCS_LINE_LIMIT) {
    const oldSet = new Set(a)
    return b.map((text) => ({ type: oldSet.has(text) ? 'same' : 'add', text }))
  }

  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] })
      i++
    } else {
      out.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] })
  while (j < m) out.push({ type: 'add', text: b[j++] })
  return out
}
