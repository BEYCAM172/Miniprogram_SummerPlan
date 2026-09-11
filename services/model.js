const date = require('../utils/date')
const id = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()
function occursOn(task, day) {
  if (day < task.date) return false
  const repeat = task.repeat || { type: 'once' }
  if (repeat.type === 'once') return day === task.date
  if (task.repeatEnd && day > task.repeatEnd) return false
  if (repeat.type === 'daily') return true
  return repeat.type === 'weekly' && (repeat.weekdays || []).includes(date.parse(day).getDay())
}
function instancesForDay(snapshot, day) {
  const records = snapshot.records || []
  const movedIn = records.filter(r => r.rescheduledTo === day && !r.cancelled)
  const movedKeys = new Set(records.filter(r => r.rescheduledTo && !r.cancelled).map(r => `${r.taskId}@${r.occurrenceDate}`))
  const result = []
  ;(snapshot.tasks || []).forEach(task => {
    if (!occursOn(task, day) || movedKeys.has(`${task._id}@${day}`)) return
    const record = records.find(r => r.taskId === task._id && r.occurrenceDate === day)
    if (record && record.cancelled) return
    result.push(instanceFrom(task, record, day, day))
  })
  movedIn.forEach(record => {
    const task = (snapshot.tasks || []).find(item => item._id === record.taskId)
    if (task) result.push(instanceFrom(task, record, record.occurrenceDate, day))
  })
  return result.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
}
function instanceFrom(task, record, occurrenceDate, displayDate) {
  const has = key => record && Object.prototype.hasOwnProperty.call(record, key)
  return {
    ...task,
    taskId: task._id,
    instanceKey: `${task._id}@${occurrenceDate}`,
    title: has('overrideTitle') ? record.overrideTitle : task.title,
    time: has('overrideTime') ? record.overrideTime : task.time,
    note: has('overrideNote') ? record.overrideNote : task.note,
    goalId: has('overrideGoalId') ? record.overrideGoalId : task.goalId,
    occurrenceDate,
    displayDate,
    done: Boolean(record && record.done),
    record
  }
}
function sample(start, end) {
  const goal1 = { _id: id('goal'), title: '完成小程序原型', description: '把课程项目做成真正能用的作品', color: '#1769ff', deadline: date.addDays(start, Math.min(21, date.diffDays(start, end))), createdAt: now(), updatedAt: now() }
  const goal2 = { _id: id('goal'), title: '保持运动', description: '每周至少运动三次', color: '#16a36a', deadline: end, createdAt: now(), updatedAt: now() }
  const tasks = [
    { _id: id('task'), title: '完成项目首页', date: start, time: '14:00', note: '实现今天页布局', goalId: goal1._id, repeat: { type: 'once', weekdays: [] }, repeatEnd: end },
    { _id: id('task'), title: '英语阅读', date: start, time: '10:00', note: '阅读 30 分钟', goalId: '', repeat: { type: 'daily', weekdays: [] }, repeatEnd: end },
    { _id: id('task'), title: '晨跑 3 公里', date: start, time: '08:30', note: '', goalId: goal2._id, repeat: { type: 'weekly', weekdays: [1, 3, 5] }, repeatEnd: end },
    { _id: id('task'), title: '阅读 20 页', date: start, time: '21:00', note: '', goalId: '', repeat: { type: 'daily', weekdays: [] }, repeatEnd: end }
  ].map(item => ({ ...item, repeatToVacationEnd: item.repeat.type !== 'once', createdAt: now(), updatedAt: now() }))
  const historyEnd = date.addDays(date.today() < end ? date.today() : end, -1)
  const historyStart = date.addDays(historyEnd, -34) > start ? date.addDays(historyEnd, -34) : start
  const records = historyStart <= historyEnd ? date.eachDay(historyStart, historyEnd).flatMap((day, dayIndex) => tasks
    .filter(task => occursOn(task, day))
    .filter((task, taskIndex) => (dayIndex + taskIndex) % 4 !== 0)
    .map(task => ({ _id: id('record'), taskId: task._id, occurrenceDate: day, done: true, completedAt: `${day}T12:00:00.000Z`, createdAt: now(), updatedAt: now() }))) : []
  return { goals: [goal1, goal2], tasks, records }
}
module.exports = { id, now, occursOn, instancesForDay, instanceFrom, sample }
