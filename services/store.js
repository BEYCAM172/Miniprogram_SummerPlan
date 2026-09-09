const model = require('./model')
const CACHE_KEY = 'summer_plan_snapshot_v1'
const QUEUE_KEY = 'summer_plan_pending_v1'
const COLLECTIONS = { vacation: 'vacations', goals: 'goals', tasks: 'tasks', records: 'task_records' }
let snapshot = wx.getStorageSync(CACHE_KEY) || { vacation: null, goals: [], tasks: [], records: [], sync: { status: 'local', lastAt: '' } }
let listeners = []
const saveCache = () => { wx.setStorageSync(CACHE_KEY, snapshot); listeners.forEach(fn => fn(snapshot)) }
const setSync = (status, lastAt) => { snapshot.sync = { status, lastAt: lastAt || (snapshot.sync && snapshot.sync.lastAt) || '' }; saveCache() }
const enqueue = op => {
  let queue = wx.getStorageSync(QUEUE_KEY) || []
  if (op.action === 'batch') queue = []
  if (op.action === 'upsert') queue = queue.filter(item => !(item.action === 'upsert' && item.type === op.type && item.item._id === op.item._id))
  if (op.action === 'remove') queue = queue.filter(item => !(item.type === op.type && ((item.item && item.item._id === op.itemId) || item.itemId === op.itemId)))
  queue.push(op); wx.setStorageSync(QUEUE_KEY, queue)
}
const db = () => wx.cloud && wx.cloud.database()

async function bootstrap() {
  if (!wx.cloud) return snapshot
  try {
    const login = await wx.cloud.callFunction({ name: 'login' })
    snapshot.openid = login.result && login.result.openid
    saveCache()
    await flushQueue()
    await syncFromCloud()
  } catch (error) { console.warn('云端初始化失败，已使用本地缓存', error); setSync('offline') }
  return snapshot
}
async function queryAll(name) {
  const rows = []; const pageSize = 100
  for (let skip = 0; skip < 500; skip += pageSize) {
    const result = await db().collection(name).orderBy('updatedAt', 'desc').skip(skip).limit(pageSize).get()
    rows.push(...(result.data || [])); if (!result.data || result.data.length < pageSize) break
  }
  return rows
}
async function syncFromCloud() {
  setSync('syncing')
  const [vacations, goals, tasks, records] = await Promise.all([queryAll(COLLECTIONS.vacation), queryAll(COLLECTIONS.goals), queryAll(COLLECTIONS.tasks), queryAll(COLLECTIONS.records)])
  snapshot = { ...snapshot, vacation: vacations[0] || null, goals, tasks, records, sync: { status: 'synced', lastAt: new Date().toISOString() } }
  saveCache(); return snapshot
}
function localUpsert(type, item) {
  if (type === 'vacation') snapshot.vacation = item
  else { const index = snapshot[type].findIndex(value => value._id === item._id); if (index >= 0) snapshot[type][index] = item; else snapshot[type].push(item) }
  setSync('pending')
}
async function cloudUpsert(type, item) {
  const payload = { ...item }; delete payload._id; delete payload._openid
  await db().collection(COLLECTIONS[type]).doc(item._id).set({ data: payload })
}
async function upsert(type, values) {
  const item = { ...values, _id: values._id || model.id(type), updatedAt: model.now(), createdAt: values.createdAt || model.now() }
  localUpsert(type, item)
  try { await cloudUpsert(type, item); setSync('synced', new Date().toISOString()) }
  catch (error) { enqueue({ action: 'upsert', type, item }); setSync('offline'); throw error }
  return item
}
async function remove(type, itemId) {
  const linkedTasks = type === 'goals' ? snapshot.tasks.filter(task => task.goalId === itemId) : []
  const linkedRecords = type === 'tasks' ? snapshot.records.filter(record => record.taskId === itemId) : []
  if (type === 'vacation') snapshot.vacation = null
  else snapshot[type] = snapshot[type].filter(item => item._id !== itemId)
  if (type === 'goals') snapshot.tasks = snapshot.tasks.map(task => task.goalId === itemId ? { ...task, goalId: '', updatedAt: model.now() } : task)
  if (type === 'tasks') snapshot.records = snapshot.records.filter(record => record.taskId !== itemId)
  setSync('pending')
  try {
    await db().collection(COLLECTIONS[type]).doc(itemId).remove()
    for (const task of linkedTasks) await cloudUpsert('tasks', { ...task, goalId: '', updatedAt: model.now() })
    for (const record of linkedRecords) await db().collection(COLLECTIONS.records).doc(record._id).remove()
    setSync('synced', new Date().toISOString())
  }
  catch (error) {
    enqueue({ action: 'remove', type, itemId })
    linkedTasks.forEach(task => enqueue({ action: 'upsert', type: 'tasks', item: { ...task, goalId: '', updatedAt: model.now() } }))
    linkedRecords.forEach(record => enqueue({ action: 'remove', type: 'records', itemId: record._id }))
    setSync('offline'); throw error
  }
}
async function flushQueue() {
  const queue = wx.getStorageSync(QUEUE_KEY) || []
  if (!queue.length || !db()) return
  const pending = []
  for (const op of queue) {
    try {
      if (op.action === 'upsert') await cloudUpsert(op.type, op.item)
      else if (op.action === 'remove') await db().collection(COLLECTIONS[op.type]).doc(op.itemId).remove()
      else await wx.cloud.callFunction({ name: 'batchData', data: op.data })
    } catch (error) { pending.push(op) }
  }
  wx.setStorageSync(QUEUE_KEY, pending)
  setSync(pending.length ? 'offline' : 'synced', pending.length ? '' : new Date().toISOString())
}
async function batch(action, vacation) {
  const sample = action === 'sample' ? model.sample(vacation.startDate, vacation.endDate) : null
  if (action === 'clear') snapshot = { ...snapshot, vacation: null, goals: [], tasks: [], records: [] }
  else snapshot = { ...snapshot, vacation, goals: sample.goals, tasks: sample.tasks, records: sample.records }
  setSync('pending')
  try {
    await wx.cloud.callFunction({ name: 'batchData', data: { action, vacation, sample } })
    setSync('synced', new Date().toISOString())
  } catch (error) { enqueue({ action: 'batch', data: { action, vacation, sample } }); setSync('offline'); throw error }
}
async function toggleTask(taskId, occurrenceDate, done) {
  const existing = snapshot.records.find(item => item.taskId === taskId && item.occurrenceDate === occurrenceDate)
  return upsert('records', { ...(existing || {}), taskId, occurrenceDate, done, completedAt: done ? model.now() : '' })
}
async function reschedule(taskId, occurrenceDate, rescheduledTo) {
  const existing = snapshot.records.find(item => item.taskId === taskId && item.occurrenceDate === occurrenceDate)
  return upsert('records', { ...(existing || {}), taskId, occurrenceDate, done: false, completedAt: '', rescheduledTo })
}
function subscribe(fn) { listeners.push(fn); return () => { listeners = listeners.filter(item => item !== fn) } }
function getState() { return snapshot }
module.exports = { bootstrap, syncFromCloud, flushQueue, getState, subscribe, upsert, remove, batch, toggleTask, reschedule }
