const date = require('../../utils/date')
const model = require('../../services/model')
const stats = require('../../services/stats')
const store = require('../../services/store')
Page({
  data: { day: date.today(), dateLabel: '', week: [], tasks: [], doneCount: 0, overdueCount: 0, vacation: {}, progress: {}, goals: [], syncText: '' },
  onLoad() { this.unsubscribe = store.subscribe(() => this.refresh()); this.refresh() },
  onUnload() { if (this.unsubscribe) this.unsubscribe() },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 0 }); this.refresh() },
  refresh() {
    const state = store.getState()
    if (!state.vacation) return wx.reLaunch({ url: '/pages/setup/setup' })
    const day = this.data.day < state.vacation.startDate ? state.vacation.startDate : this.data.day > state.vacation.endDate ? state.vacation.endDate : this.data.day
    const tasks = model.instancesForDay(state, day)
    const week = Array.from({ length: 7 }, (_, i) => {
      const value = date.addDays(day, i - 3); const d = date.parse(value)
      return { value, weekday: date.weekdayCN(value), number: d.getDate(), selected: value === day, inVacation: value >= state.vacation.startDate && value <= state.vacation.endDate, hasTask: model.instancesForDay(state, value).length > 0 }
    })
    const yesterday = date.addDays(date.today(), -1)
    const overdueStart = state.vacation.startDate
    const allOverdue = overdueStart <= yesterday ? date.eachDay(overdueStart, yesterday < state.vacation.endDate ? yesterday : state.vacation.endDate)
      .flatMap(value => model.instancesForDay(state, value)).filter(item => !item.done) : []
    const goals = state.goals.map(item => ({ ...item, progress: stats.goalProgress(state, item._id) }))
      .sort((a, b) => {
        const aActive = a.deadline >= date.today() && a.progress.percent < 100 ? 0 : 1
        const bActive = b.deadline >= date.today() && b.progress.percent < 100 ? 0 : 1
        return aActive - bActive || a.deadline.localeCompare(b.deadline)
      }).slice(0, 2)
    const syncMap = { syncing: '同步中', synced: '已同步', offline: '离线模式', pending: '等待同步', local: '本地数据' }
    this.setData({ day, dateLabel: `${date.monthDay(day)} 周${date.weekdayCN(day)}`, week, tasks, doneCount: tasks.filter(item => item.done).length, overdueCount: allOverdue.length, vacation: state.vacation, progress: stats.vacationProgress(state.vacation), goals, syncText: syncMap[state.sync.status] || '本地数据' })
  },
  selectDay(e) { const day = e.currentTarget.dataset.day; if (day < this.data.vacation.startDate || day > this.data.vacation.endDate) return; this.setData({ day }, () => this.refresh()) },
  async toggle(e) {
    const { id, day, done } = e.currentTarget.dataset
    wx.vibrateShort({ type: 'light' })
    try { await store.toggleTask(id, day, !done) } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }) }
  },
  taskMenu(e) {
    const { id, day, displayDay } = e.currentTarget.dataset
    wx.showActionSheet({ itemList: ['编辑任务', '移到今天', '选择新日期', '删除任务…'], success: res => {
      if (res.tapIndex === 0) wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${id}&occurrenceDate=${day}&displayDate=${displayDay || day}` })
      if (res.tapIndex === 1) this.move(id, day, date.today())
      if (res.tapIndex === 2) this.setData({ movingId: id, movingDay: day, showMovePicker: true })
      if (res.tapIndex === 3) this.openTaskEditor(id, day, displayDay || day)
    } })
  },
  chooseMove(e) { this.setData({ showMovePicker: false }); this.move(this.data.movingId, this.data.movingDay, e.detail.value) },
  async move(id, from, to) { const target = to < this.data.vacation.startDate ? this.data.vacation.startDate : to > this.data.vacation.endDate ? this.data.vacation.endDate : to; try { await store.reschedule(id, from, target); wx.showToast({ title: '已调整日期' }) } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }) } },
  showOverdue() { wx.navigateTo({ url: '/pages/overdue/overdue' }) },
  openTaskEditor(id, day, displayDay) { wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${id}&occurrenceDate=${day}&displayDate=${displayDay}` }) },
  openGoal(e) { wx.navigateTo({ url: `/pages/goal-edit/goal-edit?id=${e.currentTarget.dataset.id}` }) },
  addGoal() { wx.navigateTo({ url: '/pages/goal-edit/goal-edit' }) }
})
