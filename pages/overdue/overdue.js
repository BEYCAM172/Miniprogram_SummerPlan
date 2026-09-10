const date = require('../../utils/date')
const model = require('../../services/model')
const store = require('../../services/store')

Page({
  data: { items: [], vacation: {}, movingId: '', movingDay: '', moveDate: '' },
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
    this.setData({ items: items.reverse(), vacation: state.vacation })
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
