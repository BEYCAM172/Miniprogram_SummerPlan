const stats = require('../../services/stats')
const store = require('../../services/store')
Page({
  data: { vacation: {}, progress: {}, summary: {}, heatmap: [], syncText: '', syncDetail: '', syncing: false },
  onLoad() { this.unsubscribe = store.subscribe(() => this.refresh()) },
  onUnload() { if (this.unsubscribe) this.unsubscribe() },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 2 }); this.refresh() },
  refresh() {
    const state = store.getState(); if (!state.vacation) return
    const map = { syncing: '正在同步', synced: '云端已同步', offline: '当前离线', pending: '等待同步', local: '仅本地' }
    const d = state.sync.lastAt ? new Date(state.sync.lastAt) : null
    this.setData({ vacation: state.vacation, progress: stats.vacationProgress(state.vacation), summary: stats.summary(state), heatmap: stats.heatmap(state), syncText: map[state.sync.status] || '仅本地', syncDetail: d ? `最近同步 ${d.getMonth()+1}月${d.getDate()}日` : '尚未完成云端同步' })
  },
  async retry() { this.setData({ syncing: true }); try { await store.flushQueue(); await store.syncFromCloud(); wx.showToast({ title: '同步完成' }) } catch(e) { wx.showToast({ title: '同步失败', icon: 'none' }) } this.setData({ syncing: false }) },
  editVacation() { wx.navigateTo({ url: '/pages/setup/setup?edit=1' }) },
  restore() { wx.showModal({ title: '恢复示例计划？', content: '当前目标、任务和完成记录将被覆盖。', success: async r => { if (!r.confirm) return; try { await store.batch('sample', store.getState().vacation) } catch(e) {}; this.refresh() } }) },
  clear() { wx.showModal({ title: '清空所有数据？', content: '该操作会删除当前账号的全部暑期计划。', confirmColor: '#d83b2d', success: async r => { if (!r.confirm) return; try { await store.batch('clear') } catch(e) {}; wx.reLaunch({ url: '/pages/setup/setup' }) } }) },
  showHeat(e) { const x=e.currentTarget.dataset; if(x.total) wx.showToast({ title: `${x.label} 完成 ${x.count}/${x.total}`, icon: 'none' }) }
})
