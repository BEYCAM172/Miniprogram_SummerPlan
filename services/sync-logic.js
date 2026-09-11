function sameTarget(op, type, itemId) {
  return op.type === type && ((op.item && op.item._id === itemId) || op.itemId === itemId)
}

function coalesceQueue(queue, op) {
  if (op.action === 'batch') return [op]
  const itemId = op.item ? op.item._id : op.itemId
  return queue.filter(item => item.action === 'batch' || !sameTarget(item, op.type, itemId)).concat(op)
}

function mergePendingList(type, cloudRows, queue) {
  const result = new Map(cloudRows.map(item => [item._id, item]))
  queue.filter(op => op.type === type).forEach(op => {
    if (op.action === 'remove') result.delete(op.itemId)
    if (op.action === 'upsert') result.set(op.item._id, op.item)
  })
  return Array.from(result.values())
}

function isNewer(left, right) {
  return String(left && left.updatedAt || '') > String(right && right.updatedAt || '')
}

module.exports = { sameTarget, coalesceQueue, mergePendingList, isNewer }
