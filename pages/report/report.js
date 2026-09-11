const reportService = require('../../services/report')
const store = require('../../services/store')

Page({
  data: { report: null },
  onLoad() { this.unsubscribe = store.subscribe(() => this.refresh()) },
  onUnload() { if (this.unsubscribe) this.unsubscribe() },
  onShow() { this.refresh() },
  refresh() {
    const report = reportService.buildReport(store.getState())
    if (!report) return wx.navigateBack()
    this.setData({ report })
  },
  back() { wx.navigateBack() },
  copySummary() {
    wx.setClipboardData({ data: this.data.report.shareText, success: () => wx.showToast({ title: '总结已复制' }) })
  },
  onShareAppMessage() {
    return { title: this.data.report ? this.data.report.shareText : '我的暑期计划', path: '/pages/index/index' }
  }
})
