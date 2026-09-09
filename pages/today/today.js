const date = require('../../utils/date')
const model = require('../../services/model')
const stats = require('../../services/stats')
const store = require('../../services/store')
Page({
  data: { day: date.today(), dateLabel: '', week: [], tasks: [], doneCount: 0, overdue: [], overdueCount: 0, vacation: {}, progress: {}, goal: null, syncText: '' },
  onLoad() { this.unsubscribe = store.subscribe(() => this.refresh()); this.refresh() },
  onUnload() { if (this.unsubscribe) this.unsubscribe() },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 0 }); this.refresh() },
  refresh() {
    const state = store.getState()
    if (!state.vacation) return wx.reLaunch({ url: '/pages/setup/setup' })
    const day = this.data.day
    const tasks = model.instancesForDay(state, day)
    const week = Array.from({ length: 7 }, (_, i) => {
      const value = date.addDays(day, i - 3); const d = date.parse(value)
      return { value, weekday: date.weekdayCN(value), number: d.getDate(), selected: value === day, hasTask: model.instancesForDay(state, value).length > 0 }
    })
    const yesterday = date.addDays(date.today(), -1)
    const recentStart = date.addDays(date.today(), -7) > state.vacation.startDate ? date.addDays(date.today(), -7) : state.vacation.startDate
    const allOverdue = recentStart <= yesterday ? date.eachDay(recentStart, yesterday < state.vacation.endDate ? yesterday : state.vacation.endDate)
      .flatMap(value => model.instancesForDay(state, value)).filter(item => !item.done) : []
    const overdue = allOverdue.slice(-6)
    const goalData = state.goals[0]
    const goal = goalData ? { ...goalData, progress: stats.goalProgress(state, goalData._id) } : null
    const syncMap = { syncing: '同步中', synced: '已同步', offline: '离线模式', pending: '等待同步', local: '本地数据' }
    this.setData({ day, dateLabel: `${date.monthDay(day)} 周${date.weekdayCN(day)}`, week, tasks, doneCount: tasks.filter(item => item.done).length, overdue, overdueCount: allOverdue.length, vacation: state.vacation, progress: stats.vacationProgress(state.vacation), goal, syncText: syncMap[state.sync.status] || '本地数据' })
  },
  selectDay(e) { this.setData({ day: e.currentTarget.dataset.day }, () => this.refresh()) },
  async toggle(e) {
    const { id, day, done } = e.currentTarget.dataset
    wx.vibrateShort({ type: 'light' })
    try { await store.toggleTask(id, day, !done) } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }) }
  },
  taskMenu(e) {
    const { id, day } = e.currentTarget.dataset
    wx.showActionSheet({ itemList: ['编辑任务', '移到今天', '选择新日期', '删除整个任务'], success: res => {
      if (res.tapIndex === 0) wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${id}` })
      if (res.tapIndex === 1) this.move(id, day, date.today())
      if (res.tapIndex === 2) this.setData({ movingId: id, movingDay: day, showMovePicker: true })
      if (res.tapIndex === 3) this.confirmDelete(id)
    } })
  },
  chooseMove(e) { this.setData({ showMovePicker: false }); this.move(this.data.movingId, this.data.movingDay, e.detail.value) },
  async move(id, from, to) { try { await store.reschedule(id, from, to); wx.showToast({ title: '已调整日期' }) } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }) } },
  showOverdue() {
    const list = this.data.overdue
    if (!list.length) return
    wx.showActionSheet({
      itemList: list.map(item => `${date.monthDay(item.occurrenceDate)} · ${item.title}`),
      success: result => {
        const item = list[result.tapIndex]
        this.move(item._id, item.occurrenceDate, date.today())
      }
    })
  },
  confirmDelete(id) { wx.showModal({ title: '删除任务？', content: '重复任务的全部日期也会被删除。', confirmColor: '#d83b2d', success: async res => { if (res.confirm) { try { await store.remove('tasks', id) } catch (error) {} } } }) },
  addGoal() { wx.navigateTo({ url: '/pages/goal-edit/goal-edit' }) }
})
