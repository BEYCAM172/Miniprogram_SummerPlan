const model = require('./model')
const syncLogic = require('./sync-logic')

const CACHE_KEY = 'summer_plan_snapshot_v1'
const QUEUE_KEY = 'summer_plan_pending_v1'
const COLLECTIONS = { vacation: 'vacations', goals: 'goals', tasks: 'tasks', records: 'task_records' }
const emptySnapshot = () => ({ vacation: null, goals: [], tasks: [], records: [], sync: { status: 'local', lastAt: '', pending: 0, error: '' } })

let snapshot = wx.getStorageSync(CACHE_KEY) || emptySnapshot()
let listeners = []
let syncPromise = null
let flushPromise = null

const getQueue = () => wx.getStorageSync(QUEUE_KEY) || []
const pendingCount = () => getQueue().length
const errorText = error => {
  if (!error) return ''
  const message = error.errMsg || error.message || String(error)
  if (/timeout|timed out/i.test(message)) return '云服务响应超时，请稍后重试'
  if (/network|request:fail|offline/i.test(message)) return '网络不可用，修改已保存在本机'
  if (/permission|auth|document.update:fail/i.test(message)) return '云数据库权限异常，请检查集合权限'
  return '云端同步失败，修改已保存在本机'
}
const saveCache = () => {
  wx.setStorageSync(CACHE_KEY, snapshot)
  listeners.forEach(fn => fn(snapshot))
}
const setSync = (status, options = {}) => {
  const current = snapshot.sync || {}
  snapshot.sync = {
    status,
    lastAt: options.lastAt !== undefined ? options.lastAt : current.lastAt || '',
    pending: pendingCount(),
    error: options.error !== undefined ? options.error : current.error || ''
  }
  saveCache()
}
const writeQueue = queue => {
  wx.setStorageSync(QUEUE_KEY, queue)
  if (snapshot.sync) snapshot.sync.pending = queue.length
}
const enqueue = op => {
  writeQueue(syncLogic.coalesceQueue(getQueue(), op))
}
const dequeueTarget = (type, itemId) => writeQueue(getQueue().filter(op => op.action === 'batch' || !syncLogic.sameTarget(op, type, itemId)))
const dequeueTargets = (type, itemIds) => {
  const ids = new Set(itemIds)
  writeQueue(getQueue().filter(op => op.action === 'batch' || !ids.has(op.item && op.item._id || op.itemId) || op.type !== type))
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
  } catch (error) {
    console.warn('云端初始化失败，已使用本地缓存', error)
    setSync('offline', { error: errorText(error) })
  }
  return snapshot
}

async function queryAll(name) {
  const rows = []
  const pageSize = 100
  let skip = 0
  while (true) {
    const result = await db().collection(name).orderBy('updatedAt', 'desc').skip(skip).limit(pageSize).get()
    const page = result.data || []
    rows.push(...page)
    if (page.length < pageSize) break
    skip += pageSize
  }
  return rows
}

async function doSyncFromCloud() {
  setSync('syncing', { error: '' })
  try {
    const [vacations, goals, tasks, records] = await Promise.all([
      queryAll(COLLECTIONS.vacation), queryAll(COLLECTIONS.goals), queryAll(COLLECTIONS.tasks), queryAll(COLLECTIONS.records)
    ])
    const queue = getQueue()
    if (queue.some(op => op.action === 'batch')) {
      snapshot.sync = { status: 'pending', lastAt: snapshot.sync && snapshot.sync.lastAt || '', pending: queue.length, error: '' }
      saveCache()
      return snapshot
    }
    const vacationOps = queue.filter(op => op.type === 'vacation')
    let vacation = vacations[0] || null
    vacationOps.forEach(op => { vacation = op.action === 'remove' ? null : op.item })
    snapshot = {
      ...snapshot,
      vacation,
      goals: syncLogic.mergePendingList('goals', goals, queue),
      tasks: syncLogic.mergePendingList('tasks', tasks, queue),
      records: syncLogic.mergePendingList('records', records, queue),
      sync: { status: queue.length ? 'pending' : 'synced', lastAt: new Date().toISOString(), pending: queue.length, error: '' }
    }
    saveCache()
    return snapshot
  } catch (error) {
    setSync('offline', { error: errorText(error) })
    throw error
  }
}

function syncFromCloud() {
  if (syncPromise) return syncPromise
  syncPromise = doSyncFromCloud().finally(() => { syncPromise = null })
  return syncPromise
}

function localUpsert(type, item) {
  if (type === 'vacation') snapshot.vacation = item
  else {
    const index = snapshot[type].findIndex(value => value._id === item._id)
    if (index >= 0) snapshot[type][index] = item
    else snapshot[type].push(item)
  }
  setSync('pending', { error: '' })
}

async function getCloudItem(type, itemId) {
  const result = await db().collection(COLLECTIONS[type]).where({ _id: itemId }).limit(1).get()
  return result.data && result.data[0]
}

async function cloudUpsert(type, item, compareRemote = false) {
  if (compareRemote) {
    const remote = await getCloudItem(type, item._id)
    if (remote && syncLogic.isNewer(remote, item)) {
      localUpsert(type, remote)
      return { skipped: true, remote }
    }
  }
  const payload = { ...item }
  delete payload._id
  delete payload._openid
  await db().collection(COLLECTIONS[type]).doc(item._id).set({ data: payload })
  return { skipped: false }
}

async function upsert(type, values) {
  const timestamp = model.now()
  const item = { ...values, _id: values._id || model.id(type), updatedAt: timestamp, createdAt: values.createdAt || timestamp }
  localUpsert(type, item)
  try {
    const result = await cloudUpsert(type, item, true)
    dequeueTarget(type, item._id)
    setSync(pendingCount() ? 'pending' : 'synced', { lastAt: new Date().toISOString(), error: '' })
    return result.remote || item
  } catch (error) {
    enqueue({ action: 'upsert', type, item })
    setSync('offline', { error: errorText(error) })
    error.localItem = item
    throw error
  }
}

async function cloudRemove(type, itemId, operationTime = '', compareRemote = false) {
  if (compareRemote) {
    const remote = await getCloudItem(type, itemId)
    if (remote && String(remote.updatedAt || '') > operationTime) {
      localUpsert(type, remote)
      return { skipped: true, remote }
    }
  }
  await db().collection(COLLECTIONS[type]).doc(itemId).remove()
  return { skipped: false }
}

async function remove(type, itemId) {
  const operationTime = model.now()
  const linkedTasks = type === 'goals' ? snapshot.tasks.filter(task => task.goalId === itemId) : []
  const linkedOverrideRecords = type === 'goals' ? snapshot.records.filter(record => record.overrideGoalId === itemId) : []
  const linkedRecords = type === 'tasks' ? snapshot.records.filter(record => record.taskId === itemId) : []
  if (type === 'vacation') snapshot.vacation = null
  else snapshot[type] = snapshot[type].filter(item => item._id !== itemId)
  if (type === 'goals') snapshot.tasks = snapshot.tasks.map(task => task.goalId === itemId ? { ...task, goalId: '', updatedAt: operationTime } : task)
  if (type === 'goals') snapshot.records = snapshot.records.map(record => record.overrideGoalId === itemId ? { ...record, overrideGoalId: '', updatedAt: operationTime } : record)
  if (type === 'tasks') snapshot.records = snapshot.records.filter(record => record.taskId !== itemId)
  setSync('pending', { error: '' })
  try {
    const result = await cloudRemove(type, itemId, operationTime, true)
    dequeueTarget(type, itemId)
    if (result.skipped) {
      await syncFromCloud()
      return
    }
    for (const task of linkedTasks) await cloudUpsert('tasks', { ...task, goalId: '', updatedAt: operationTime })
    for (const record of linkedOverrideRecords) await cloudUpsert('records', { ...record, overrideGoalId: '', updatedAt: operationTime })
    for (const record of linkedRecords) await cloudRemove('records', record._id)
    setSync(pendingCount() ? 'pending' : 'synced', { lastAt: new Date().toISOString(), error: '' })
  } catch (error) {
    enqueue({ action: 'remove', type, itemId, updatedAt: operationTime })
    linkedTasks.forEach(task => enqueue({ action: 'upsert', type: 'tasks', item: { ...task, goalId: '', updatedAt: operationTime } }))
    linkedOverrideRecords.forEach(record => enqueue({ action: 'upsert', type: 'records', item: { ...record, overrideGoalId: '', updatedAt: operationTime } }))
    linkedRecords.forEach(record => enqueue({ action: 'remove', type: 'records', itemId: record._id, updatedAt: operationTime }))
    setSync('offline', { error: errorText(error) })
    throw error
  }
}

async function applyQueuedOperation(op) {
  if (op.action === 'upsert') return cloudUpsert(op.type, op.item, true)
  if (op.action === 'remove') return cloudRemove(op.type, op.itemId, op.updatedAt || '', true)
  await wx.cloud.callFunction({ name: 'batchData', data: op.data })
  return { skipped: false }
}

async function doFlushQueue() {
  const queue = getQueue()
  if (!queue.length || !db()) return { pending: queue.length, synced: 0 }
  setSync('syncing', { error: '' })
  const pending = []
  let synced = 0
  let lastError = null
  for (const op of queue) {
    try {
      await applyQueuedOperation(op)
      synced += 1
    } catch (error) {
      pending.push(op)
      lastError = error
    }
  }
  writeQueue(pending)
  setSync(pending.length ? 'offline' : 'synced', {
    lastAt: pending.length ? undefined : new Date().toISOString(),
    error: pending.length ? errorText(lastError) : ''
  })
  return { pending: pending.length, synced }
}

function flushQueue() {
  if (flushPromise) return flushPromise
  flushPromise = doFlushQueue().finally(() => { flushPromise = null })
  return flushPromise
}

async function batch(action, vacation) {
  const sample = action === 'sample' ? model.sample(vacation.startDate, vacation.endDate) : null
  if (action === 'clear') snapshot = { ...snapshot, vacation: null, goals: [], tasks: [], records: [] }
  else snapshot = { ...snapshot, vacation, goals: sample.goals, tasks: sample.tasks, records: sample.records }
  setSync('pending', { error: '' })
  try {
    await wx.cloud.callFunction({ name: 'batchData', data: { action, vacation, sample } })
    writeQueue([])
    setSync('synced', { lastAt: new Date().toISOString(), error: '' })
  } catch (error) {
    enqueue({ action: 'batch', data: { action, vacation, sample } })
    setSync('offline', { error: errorText(error) })
    throw error
  }
}

async function toggleTask(taskId, occurrenceDate, done) {
  const existing = snapshot.records.find(item => item.taskId === taskId && item.occurrenceDate === occurrenceDate)
  return upsert('records', { ...(existing || {}), taskId, occurrenceDate, done, completedAt: done ? model.now() : '' })
}

async function reschedule(taskId, occurrenceDate, rescheduledTo) {
  const existing = snapshot.records.find(item => item.taskId === taskId && item.occurrenceDate === occurrenceDate)
  return upsert('records', { ...(existing || {}), taskId, occurrenceDate, done: false, completedAt: '', rescheduledTo })
}

async function rescheduleMany(moves) {
  if (!moves.length) return { count: 0, offline: false }
  const timestamp = model.now()
  const records = moves.map(move => {
    const existing = snapshot.records.find(item => item.taskId === move.taskId && item.occurrenceDate === move.occurrenceDate)
    return {
      ...(existing || {}),
      _id: existing && existing._id || model.id('records'),
      taskId: move.taskId,
      occurrenceDate: move.occurrenceDate,
      done: false,
      completedAt: '',
      cancelled: false,
      rescheduledTo: move.rescheduledTo,
      createdAt: existing && existing.createdAt || timestamp,
      updatedAt: timestamp
    }
  })
  records.forEach(record => {
    const index = snapshot.records.findIndex(item => item._id === record._id)
    if (index >= 0) snapshot.records[index] = record
    else snapshot.records.push(record)
  })
  setSync('pending', { error: '' })
  try {
    await wx.cloud.callFunction({ name: 'batchData', data: { action: 'reschedule', records } })
    dequeueTargets('records', records.map(record => record._id))
    setSync(pendingCount() ? 'pending' : 'synced', { lastAt: new Date().toISOString(), error: '' })
    return { count: records.length, offline: false }
  } catch (error) {
    records.forEach(record => enqueue({ action: 'upsert', type: 'records', item: record }))
    setSync('offline', { error: errorText(error) })
    return { count: records.length, offline: true }
  }
}

async function pruneTaskRecords(task) {
  const stale = snapshot.records.filter(record => record.taskId === task._id && !model.occursOn(task, record.occurrenceDate))
  for (const record of stale) {
    try { await remove('records', record._id) } catch (error) {}
  }
  return stale.length
}

function subscribe(fn) { listeners.push(fn); return () => { listeners = listeners.filter(item => item !== fn) } }
function getState() { return snapshot }

module.exports = { bootstrap, syncFromCloud, flushQueue, getState, subscribe, upsert, remove, batch, toggleTask, reschedule, rescheduleMany, pruneTaskRecords, pendingCount }
