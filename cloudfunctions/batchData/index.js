const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const names = ['vacations', 'goals', 'tasks', 'task_records']
async function clear(openid) { for (const name of names) await db.collection(name).where({ _openid: openid }).remove() }
async function put(name, openid, item) {
  const data = { ...item, _openid: openid }; const id = data._id; delete data._id
  await db.collection(name).doc(id).set({ data })
}
exports.main = async event => {
  const { OPENID: openid } = cloud.getWXContext()
  if (!['clear', 'sample'].includes(event.action)) throw new Error('Unsupported batch action')
  await clear(openid)
  if (event.action === 'sample') {
    await put('vacations', openid, event.vacation)
    for (const goal of event.sample.goals || []) await put('goals', openid, goal)
    for (const task of event.sample.tasks || []) await put('tasks', openid, task)
  }
  return { ok: true }
}
