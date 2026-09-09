const cloudConfig = require('./config/cloud')
const store = require('./services/store')

App({
  onLaunch() {
    if (wx.cloud) {
      const options = { traceUser: true }
      if (cloudConfig.envId) options.env = cloudConfig.envId
      wx.cloud.init(options)
    }
    this.ready = store.bootstrap().then(state => {
      this.globalData.openid = state.openid || ''
      this.globalData.ready = true
      return state
    })
    wx.onNetworkStatusChange(status => {
      if (status.isConnected) store.flushQueue().then(() => store.syncFromCloud()).catch(() => {})
    })
  },
  globalData: { ready: false, openid: '' }
})
