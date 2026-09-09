const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async () => {
  const { OPENID: openid } = cloud.getWXContext()
  const now = db.serverDate()
  const found = await db.collection('users').where({ _openid: openid }).limit(1).get()
  if (found.data.length) await db.collection('users').doc(found.data[0]._id).update({ data: { lastVisitAt: now, dataVersion: 1 } })
  else await db.collection('users').add({ data: { _openid: openid, firstVisitAt: now, lastVisitAt: now, dataVersion: 1 } })
  return { openid }
}
