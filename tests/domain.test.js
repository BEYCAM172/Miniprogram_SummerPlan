const assert = require('assert')
const date = require('../utils/date')
const model = require('../services/model')
const stats = require('../services/stats')
const syncLogic = require('../services/sync-logic')
const reschedule = require('../services/reschedule')

const state = {
  vacation: { startDate: '2026-07-01', endDate: '2026-07-07' },
  goals: [{ _id: 'goal' }],
  tasks: [
    { _id: 'daily', date: '2026-07-01', time: '', goalId: 'goal', repeat: { type: 'daily', weekdays: [] }, repeatEnd: '2026-07-07' },
    { _id: 'weekly', date: '2026-07-01', time: '', goalId: '', repeat: { type: 'weekly', weekdays: [3] }, repeatEnd: '2026-07-07' }
  ],
  records: [{ _id: 'record', taskId: 'daily', occurrenceDate: '2026-07-01', done: true }]
}

assert.equal(model.instancesForDay(state, '2026-07-01').length, 2)
assert.equal(model.instancesForDay(state, '2026-07-02').length, 1)
assert.equal(stats.goalProgress(state, 'goal').total, 7)
assert.equal(stats.goalProgress(state, 'goal').done, 1)
assert.equal(stats.goalProgress(state, 'goal', '2026-07-03').total, 3)
assert.equal(stats.summary(state, '2026-07-03').due, 4)
assert.equal(stats.summary(state, '2026-07-03').percent, 25)
assert.equal(date.addDays('2026-07-31', 1), '2026-08-01')

const changedRepeat = { ...state.tasks[0], date: '2026-07-03', repeat: { type: 'once', weekdays: [] } }
assert.equal(model.occursOn(changedRepeat, '2026-07-01'), false)
assert.equal(model.occursOn(changedRepeat, '2026-07-03'), true)

const moved = { ...state, records: [{ _id: 'move', taskId: 'weekly', occurrenceDate: '2026-07-01', done: false, rescheduledTo: '2026-07-02' }] }
assert.equal(model.instancesForDay(moved, '2026-07-01').some(item => item._id === 'weekly'), false)
assert.equal(model.instancesForDay(moved, '2026-07-02').filter(item => item._id === 'weekly').length, 1)

const overridden = { ...state, records: [{ _id: 'override', taskId: 'daily', occurrenceDate: '2026-07-02', done: false, overrideTitle: '只改今天', overrideTime: '', overrideGoalId: '' }] }
const overriddenInstance = model.instancesForDay(overridden, '2026-07-02').find(item => item._id === 'daily')
assert.equal(overriddenInstance.title, '只改今天')
assert.equal(overriddenInstance.time, '')
assert.equal(overriddenInstance.goalId, '')

const cancelled = { ...state, records: [{ _id: 'cancel', taskId: 'daily', occurrenceDate: '2026-07-02', done: false, cancelled: true }] }
assert.equal(model.instancesForDay(cancelled, '2026-07-02').some(item => item._id === 'daily'), false)

const queued = syncLogic.coalesceQueue(
  [{ action: 'upsert', type: 'tasks', item: { _id: 'task-1', title: '旧标题' } }],
  { action: 'upsert', type: 'tasks', item: { _id: 'task-1', title: '新标题' } }
)
assert.equal(queued.length, 1)
assert.equal(queued[0].item.title, '新标题')
assert.equal(syncLogic.isNewer({ updatedAt: '2026-09-10T10:00:00.000Z' }, { updatedAt: '2026-09-09T10:00:00.000Z' }), true)
assert.deepEqual(syncLogic.mergePendingList('tasks', [{ _id: 'task-1' }], [{ action: 'remove', type: 'tasks', itemId: 'task-1' }]), [])

const backlog = ['2026-07-01', '2026-07-02', '2026-07-03'].map((occurrenceDate, index) => ({ _id: `late-${index}`, occurrenceDate, title: `逾期 ${index + 1}`, time: '' }))
const balanced = reschedule.buildBalancedSchedule({ ...state, vacation: { startDate: '2026-07-01', endDate: '2026-07-05' }, tasks: [], records: [] }, backlog, '2026-07-04')
assert.equal(balanced.moves.length, 3)
assert.equal(balanced.groups.length, 2)
assert.equal(balanced.moves.filter(item => item.rescheduledTo === '2026-07-04').length, 2)
assert.equal(balanced.moves.filter(item => item.rescheduledTo === '2026-07-05').length, 1)
console.log('domain tests OK')
