const pad = n => String(n).padStart(2, '0')
const parse = value => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const [y, m, d] = String(value).split('-').map(Number)
  return new Date(y, m - 1, d)
}
const format = value => { const d = parse(value); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const today = () => format(new Date())
const addDays = (value, amount) => { const d = parse(value); d.setDate(d.getDate() + amount); return format(d) }
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)
const eachDay = (start, end) => { const result = []; for (let value = start; value <= end; value = addDays(value, 1)) result.push(value); return result }
const weekdayCN = value => ['日', '一', '二', '三', '四', '五', '六'][parse(value).getDay()]
const monthDay = value => { const d = parse(value); return `${d.getMonth() + 1}月${d.getDate()}日` }
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
module.exports = { parse, format, today, addDays, diffDays, eachDay, weekdayCN, monthDay, clamp }
