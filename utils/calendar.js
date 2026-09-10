const date = require('./date')
function monthGrid(monthValue, selected, state, instancesForDay) {
  const month = date.parse(`${monthValue}-01`)
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = month.getDay()
  const gridStart = new Date(year, monthIndex, 1 - firstWeekday)
  return Array.from({ length: 42 }, (_, index) => {
    const value = date.addDays(date.format(gridStart), index)
    const d = date.parse(value)
    const instances = instancesForDay(state, value)
    const count = instances.length
    const done = instances.filter(item => item.done).length
    const inVacation = !state.vacation || (value >= state.vacation.startDate && value <= state.vacation.endDate)
    return { value, number: d.getDate(), inMonth: d.getMonth() === monthIndex, inVacation, selected: value === selected, today: value === date.today(), count, allDone: count > 0 && done === count }
  })
}
function shiftMonth(monthValue, amount) { const d = date.parse(`${monthValue}-01`); d.setMonth(d.getMonth() + amount); return date.format(d).slice(0, 7) }
function monthLabel(value) { const [year, month] = value.split('-'); return `${year}年 ${Number(month)}月` }
module.exports = { monthGrid, shiftMonth, monthLabel }
