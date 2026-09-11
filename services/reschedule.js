const date = require('../utils/date')
const model = require('./model')

const MAX_BATCH = 200

function buildBalancedSchedule(state, overdue, current = date.today()) {
  if (!state.vacation || !overdue.length) return { moves: [], groups: [], remaining: 0 }
  const start = current < state.vacation.startDate ? state.vacation.startDate : current
  if (start > state.vacation.endDate) return { moves: [], groups: [], remaining: overdue.length }
  const days = date.eachDay(start, state.vacation.endDate)
  const load = new Map(days.map(day => [day, model.instancesForDay(state, day).length]))
  const selected = overdue.slice().sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || (a.time || '99:99').localeCompare(b.time || '99:99')).slice(0, MAX_BATCH)
  const moves = selected.map(item => {
    const target = days.reduce((best, day) => load.get(day) < load.get(best) ? day : best, days[0])
    load.set(target, load.get(target) + 1)
    return { taskId: item._id, occurrenceDate: item.occurrenceDate, rescheduledTo: target, title: item.title, time: item.time || '' }
  })
  const grouped = new Map()
  moves.forEach(move => {
    if (!grouped.has(move.rescheduledTo)) grouped.set(move.rescheduledTo, [])
    grouped.get(move.rescheduledTo).push(move)
  })
  const groups = Array.from(grouped.entries()).map(([day, items]) => ({
    day,
    label: `${date.monthDay(day)} 周${date.weekdayCN(day)}`,
    count: items.length,
    summary: items.slice(0, 3).map(item => item.title).join('、') + (items.length > 3 ? ` 等 ${items.length} 项` : '')
  }))
  return { moves, groups, remaining: Math.max(0, overdue.length - moves.length) }
}

module.exports = { MAX_BATCH, buildBalancedSchedule }
