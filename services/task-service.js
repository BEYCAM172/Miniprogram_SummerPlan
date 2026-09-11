const date = require('../utils/date')
const model = require('./model')
const store = require('./store')

function hasPastOccurrence(task, occurrenceDate) {
  if (occurrenceDate <= task.date) return false
  for (let day = task.date; day < occurrenceDate; day = date.addDays(day, 1)) {
    if (model.occursOn(task, day)) return true
  }
  return false
}

function taskValues(values) {
  return {
    title: values.title,
    date: values.date,
    time: values.time || '',
    note: values.note || '',
    goalId: values.goalId || '',
    repeat: values.repeat,
    repeatEnd: values.repeatEnd,
    repeatToVacationEnd: true
  }
}

async function attempt(operation, result) {
  try { return await operation() }
  catch (error) { result.offline = true; return error.localItem }
}

async function editOccurrence(task, occurrenceDate, values) {
  const result = { offline: false }
  const state = store.getState()
  const existing = state.records.find(item => item.taskId === task._id && item.occurrenceDate === occurrenceDate)
  const record = {
    ...(existing || {}),
    _id: existing && existing._id || model.id('records'),
    taskId: task._id,
    occurrenceDate,
    cancelled: false,
    rescheduledTo: values.date === occurrenceDate ? '' : values.date,
    overrideTitle: values.title,
    overrideTime: values.time || '',
    overrideNote: values.note || '',
    overrideGoalId: values.goalId || ''
  }
  await attempt(() => store.upsert('records', record), result)
  return result
}

async function splitFrom(task, occurrenceDate, values) {
  const result = { offline: false }
  const state = store.getState()
  const futureRecords = state.records.filter(item => item.taskId === task._id && item.occurrenceDate >= occurrenceDate)
  let nextTask
  if (hasPastOccurrence(task, occurrenceDate)) {
    await attempt(() => store.upsert('tasks', { ...task, repeatEnd: date.addDays(occurrenceDate, -1), repeatToVacationEnd: false }), result)
    nextTask = { ...taskValues(values), _id: model.id('task') }
    const saved = await attempt(() => store.upsert('tasks', nextTask), result)
    nextTask = saved || nextTask
  } else {
    nextTask = { ...task, ...taskValues(values) }
    const saved = await attempt(() => store.upsert('tasks', nextTask), result)
    nextTask = saved || nextTask
  }

  for (const record of futureRecords) {
    if (model.occursOn(nextTask, record.occurrenceDate)) {
      await attempt(() => store.upsert('records', { ...record, taskId: nextTask._id }), result)
    } else {
      await attempt(() => store.remove('records', record._id), result)
    }
  }
  return result
}

async function cancelOccurrence(task, occurrenceDate) {
  const result = { offline: false }
  const state = store.getState()
  const existing = state.records.find(item => item.taskId === task._id && item.occurrenceDate === occurrenceDate)
  await attempt(() => store.upsert('records', {
    ...(existing || {}),
    _id: existing && existing._id || model.id('records'),
    taskId: task._id,
    occurrenceDate,
    cancelled: true,
    done: false,
    completedAt: '',
    rescheduledTo: ''
  }), result)
  return result
}

async function truncateFrom(task, occurrenceDate) {
  const result = { offline: false }
  if (!hasPastOccurrence(task, occurrenceDate)) {
    await attempt(() => store.remove('tasks', task._id), result)
    return result
  }
  await attempt(() => store.upsert('tasks', { ...task, repeatEnd: date.addDays(occurrenceDate, -1), repeatToVacationEnd: false }), result)
  const futureRecords = store.getState().records.filter(item => item.taskId === task._id && item.occurrenceDate >= occurrenceDate)
  for (const record of futureRecords) await attempt(() => store.remove('records', record._id), result)
  return result
}

module.exports = { hasPastOccurrence, editOccurrence, splitFrom, cancelOccurrence, truncateFrom }
