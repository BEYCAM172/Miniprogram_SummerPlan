const assert = require('assert')

const cacheKey = 'summer_plan_snapshot_v1'
const queueKey = 'summer_plan_pending_v1'
const storage = {
  [cacheKey]: {
    vacation: { startDate: '2026-07-01', endDate: '2026-07-10' },
    goals: [],
    tasks: [{ _id: 'daily', title: '阅读', date: '2026-07-01', time: '09:00', note: '', goalId: '', repeat: { type: 'daily', weekdays: [] }, repeatEnd: '2026-07-10', createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' }],
    records: [
      { _id: 'done-1', taskId: 'daily', occurrenceDate: '2026-07-01', done: true },
      { _id: 'future-6', taskId: 'daily', occurrenceDate: '2026-07-06', done: true },
      { _id: 'future-7', taskId: 'daily', occurrenceDate: '2026-07-07', done: true }
    ],
    sync: { status: 'local', lastAt: '' }
  },
  [queueKey]: []
}

global.wx = {
  cloud: null,
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value }
}

const model = require('../services/model')
const store = require('../services/store')
const taskService = require('../services/task-service')

async function run() {
  const original = store.getState().tasks[0]
  const occurrenceResult = await taskService.editOccurrence(original, '2026-07-03', {
    title: '只在今天阅读', date: '2026-07-04', time: '10:00', note: '临时调整', goalId: ''
  })
  assert.equal(occurrenceResult.offline, true)
  assert.equal(model.instancesForDay(store.getState(), '2026-07-03').some(item => item._id === 'daily'), false)
  assert.equal(model.instancesForDay(store.getState(), '2026-07-04').some(item => item.title === '只在今天阅读'), true)

  const splitResult = await taskService.splitFrom(original, '2026-07-05', {
    title: '后续阅读', date: '2026-07-05', time: '08:00', note: '', goalId: '',
    repeat: { type: 'weekly', weekdays: [1, 3] }, repeatEnd: '2026-07-10'
  })
  assert.equal(splitResult.offline, true)
  const oldTask = store.getState().tasks.find(item => item._id === 'daily')
  const nextTask = store.getState().tasks.find(item => item._id !== 'daily')
  assert.equal(oldTask.repeatEnd, '2026-07-04')
  assert.equal(model.instancesForDay(store.getState(), '2026-07-06').some(item => item._id === nextTask._id), true)
  assert.equal(store.getState().records.find(item => item._id === 'future-6').taskId, nextTask._id)
  assert.equal(store.getState().records.some(item => item._id === 'future-7'), false)
  assert.equal(model.instancesForDay(store.getState(), '2026-07-01').some(item => item._id === 'daily' && item.done), true)

  await taskService.cancelOccurrence(nextTask, '2026-07-06')
  assert.equal(model.instancesForDay(store.getState(), '2026-07-06').some(item => item._id === nextTask._id), false)

  const batchResult = await store.rescheduleMany([{ taskId: nextTask._id, occurrenceDate: '2026-07-08', rescheduledTo: '2026-07-09' }])
  assert.equal(batchResult.offline, true)
  assert.equal(model.instancesForDay(store.getState(), '2026-07-08').some(item => item._id === nextTask._id), false)
  assert.equal(model.instancesForDay(store.getState(), '2026-07-09').some(item => item._id === nextTask._id), true)

  await taskService.truncateFrom(nextTask, '2026-07-08')
  assert.equal(store.getState().tasks.find(item => item._id === nextTask._id).repeatEnd, '2026-07-07')
  assert.equal(model.instancesForDay(store.getState(), '2026-07-08').some(item => item._id === nextTask._id), false)
  console.log('task service tests OK')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
