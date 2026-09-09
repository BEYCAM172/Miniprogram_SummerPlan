const store = require('../../services/store')
Page({
  data: { message: '正在同步你的暑假…', offline: false },
  async onLoad() {
    const app = getApp()
    const state = app.ready ? await app.ready : store.getState()
    this.setData({ offline: state.sync && state.sync.status === 'offline', message: state.sync && state.sync.status === 'offline' ? '当前离线，正在读取本地计划' : '同步完成' })
    setTimeout(() => wx.reLaunch({ url: state.vacation ? '/pages/today/today' : '/pages/setup/setup' }), 350)
  }
})
