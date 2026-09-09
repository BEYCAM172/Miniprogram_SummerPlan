const assert = require('assert')
const date = require('../utils/date')
const model = require('../services/model')
const stats = require('../services/stats')

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
assert.equal(date.addDays('2026-07-31', 1), '2026-08-01')

const moved = { ...state, records: [{ _id: 'move', taskId: 'weekly', occurrenceDate: '2026-07-01', done: false, rescheduledTo: '2026-07-02' }] }
assert.equal(model.instancesForDay(moved, '2026-07-01').some(item => item._id === 'weekly'), false)
assert.equal(model.instancesForDay(moved, '2026-07-02').filter(item => item._id === 'weekly').length, 1)
console.log('domain tests OK')
