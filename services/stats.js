const date = require('../utils/date')
const model = require('./model')
function vacationProgress(vacation, current = date.today()) {
  const total = Math.max(1, date.diffDays(vacation.startDate, vacation.endDate) + 1)
  const elapsed = date.clamp(date.diffDays(vacation.startDate, current) + 1, 0, total)
  return { total, elapsed, remaining: Math.max(0, total - elapsed), percent: Math.round(elapsed / total * 100) }
}
function allInstances(state) {
  if (!state.vacation) return []
  return date.eachDay(state.vacation.startDate, state.vacation.endDate).flatMap(day => model.instancesForDay(state, day))
}
function goalProgress(state, goalId) {
  const list = allInstances(state).filter(item => item.goalId === goalId)
  const done = list.filter(item => item.done).length
  return { done, total: list.length, percent: list.length ? Math.round(done / list.length * 100) : 0 }
}
function summary(state) {
  const list = allInstances(state); const done = list.filter(item => item.done).length
  const vacation = state.vacation; let streak = 0
  if (vacation) {
    let cursor = date.today() > vacation.endDate ? vacation.endDate : date.today()
    while (cursor >= vacation.startDate) {
      const dayItems = model.instancesForDay(state, cursor)
      if (!dayItems.some(item => item.done)) break
      streak += 1; cursor = date.addDays(cursor, -1)
    }
  }
  return { total: list.length, done, percent: list.length ? Math.round(done / list.length * 100) : 0, streak }
}
function heatmap(state) {
  if (!state.vacation) return []
  const values = date.eachDay(state.vacation.startDate, state.vacation.endDate)
  const prefix = Array.from({ length: date.parse(values[0]).getDay() }, (_, i) => ({ key: `blank-${i}`, blank: true }))
  return prefix.concat(values.map(value => {
    const items = model.instancesForDay(state, value); const done = items.filter(item => item.done).length
    const ratio = items.length ? done / items.length : 0
    return { key: value, value, label: date.monthDay(value), count: done, total: items.length, level: !done ? 0 : ratio < .5 ? 1 : ratio < 1 ? 2 : 3 }
  }))
}
module.exports = { vacationProgress, allInstances, goalProgress, summary, heatmap }
