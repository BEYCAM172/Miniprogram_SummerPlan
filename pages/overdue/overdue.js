const date = require('../../utils/date')
const model = require('../../services/model')
const store = require('../../services/store')
const reschedule = require('../../services/reschedule')

Page({
  data: { items: [], vacation: {}, movingId: '', movingDay: '', moveDate: '', canBatch: false, previewOpen: false, previewMoves: [], previewGroups: [], previewRemaining: 0, batching: false },
  onLoad() { this.unsubscribe = store.subscribe(() => this.refresh()) },
  onUnload() { if (this.unsubscribe) this.unsubscribe() },
  onShow() { this.refresh() },
  refresh() {
    const state = store.getState()
    if (!state.vacation) return
    const lastDay = date.addDays(date.today(), -1) < state.vacation.endDate ? date.addDays(date.today(), -1) : state.vacation.endDate
    const items = state.vacation.startDate <= lastDay ? date.eachDay(state.vacation.startDate, lastDay)
      .flatMap(day => model.instancesForDay(state, day))
      .filter(item => !item.done)
      .map(item => ({ ...item, key: `${item._id}@${item.occurrenceDate}`, dateText: `${date.monthDay(item.occurrenceDate)} 周${date.weekdayCN(item.occurrenceDate)}` })) : []
    this.setData({ items: items.reverse(), vacation: state.vacation, canBatch: items.length > 0 && date.today() <= state.vacation.endDate })
  },
  back() { wx.navigateBack() },
  moveToday(e) { this.move(e.currentTarget.dataset.id, e.currentTarget.dataset.day, date.today()) },
  chooseDate(e) {
    const { id, day } = e.currentTarget.dataset
    const today = date.today()
    const moveDate = today < this.data.vacation.startDate ? this.data.vacation.startDate : today > this.data.vacation.endDate ? this.data.vacation.endDate : today
    this.setData({ movingId: id, movingDay: day, moveDate })
  },
  noop() {},
  cancelPicker() { this.setData({ movingId: '', movingDay: '' }) },
  onMoveDate(e) { this.setData({ moveDate: e.detail.value }) },
  confirmMove() { this.move(this.data.movingId, this.data.movingDay, this.data.moveDate) },
  openPreview() {
    const preview = reschedule.buildBalancedSchedule(store.getState(), this.data.items)
    if (!preview.moves.length) return wx.showToast({ title: '假期内已没有可安排的日期', icon: 'none' })
    this.setData({ previewOpen: true, previewMoves: preview.moves, previewGroups: preview.groups, previewRemaining: preview.remaining })
  },
  closePreview() { if (!this.data.batching) this.setData({ previewOpen: false }) },
  async confirmBatch() {
    if (this.data.batching || !this.data.previewMoves.length) return
    this.setData({ batching: true })
    const result = await store.rescheduleMany(this.data.previewMoves)
    this.setData({ batching: false, previewOpen: false, previewMoves: [], previewGroups: [] })
    const suffix = this.data.previewRemaining ? `，另有 ${this.data.previewRemaining} 项可再次重排` : ''
    wx.showToast({ title: result.offline ? `已保存到本机${suffix}` : `已重排 ${result.count} 项${suffix}`, icon: 'none', duration: 2600 })
  },
  async move(id, from, to) {
    const target = to < this.data.vacation.startDate ? this.data.vacation.startDate : to > this.data.vacation.endDate ? this.data.vacation.endDate : to
    try {
      await store.reschedule(id, from, target)
      this.setData({ movingId: '', movingDay: '' })
      wx.showToast({ title: `已移到${date.monthDay(target)}`, icon: 'none' })
    } catch (error) {
      this.setData({ movingId: '', movingDay: '' })
      wx.showToast({ title: '已离线保存', icon: 'none' })
    }
  }
})
