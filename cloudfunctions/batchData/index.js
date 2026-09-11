const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const names = ['vacations', 'goals', 'tasks', 'task_records']
async function clear(openid) { for (const name of names) await db.collection(name).where({ _openid: openid }).remove() }
async function put(name, openid, item) {
  const data = { ...item, _openid: openid }; const id = data._id; delete data._id
  await db.collection(name).doc(id).set({ data })
}
async function putMany(name, openid, rows) {
  for (let index = 0; index < rows.length; index += 20) {
    await Promise.all(rows.slice(index, index + 20).map(item => put(name, openid, item)))
  }
}
exports.main = async event => {
  const { OPENID: openid } = cloud.getWXContext()
  if (!['clear', 'sample', 'reschedule'].includes(event.action)) throw new Error('Unsupported batch action')
  if (event.action === 'reschedule') {
    await putMany('task_records', openid, event.records || [])
    return { ok: true, count: (event.records || []).length }
  }
  await clear(openid)
  if (event.action === 'sample') {
    await put('vacations', openid, event.vacation)
    await putMany('goals', openid, event.sample.goals || [])
    await putMany('tasks', openid, event.sample.tasks || [])
    await putMany('task_records', openid, event.sample.records || [])
  }
  return { ok: true }
}
