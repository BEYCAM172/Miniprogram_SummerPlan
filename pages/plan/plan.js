const date = require('../../utils/date')
const calendar = require('../../utils/calendar')
const model = require('../../services/model')
const stats = require('../../services/stats')
const store = require('../../services/store')
Page({
  data: { tab: 'calendar', selectedDate: date.today(), month: date.today().slice(0, 7), monthLabel: '', weekdays: ['日','一','二','三','四','五','六'], cells: [], tasks: [], goals: [] },
  onLoad(options) { if (options.date) this.setData({ selectedDate: options.date, month: options.date.slice(0, 7) }); this.unsubscribe = store.subscribe(() => this.refresh()) },
  onUnload() { if (this.unsubscribe) this.unsubscribe() },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 1 }); this.refresh() },
  refresh() {
    const state = store.getState(); if (!state.vacation) return
    const selectedDate = this.data.selectedDate < state.vacation.startDate ? state.vacation.startDate : this.data.selectedDate > state.vacation.endDate ? state.vacation.endDate : this.data.selectedDate
    const month = selectedDate.slice(0, 7)
    const tasks = model.instancesForDay(state, selectedDate)
    const goals = state.goals.map(goal => ({ ...goal, progress: stats.goalProgress(state, goal._id), deadlineText: date.monthDay(goal.deadline) }))
    this.setData({ selectedDate, month, monthLabel: calendar.monthLabel(month), cells: calendar.monthGrid(month, selectedDate, state, model.instancesForDay), tasks, goals })
  },
  switchView(e) { this.setData({ tab: e.currentTarget.dataset.tab }) },
  previousMonth() { this.shiftMonth(-1) },
  nextMonth() { this.shiftMonth(1) },
  shiftMonth(amount) {
    const vacation = store.getState().vacation
    const target = calendar.shiftMonth(this.data.month, amount)
    if (target < vacation.startDate.slice(0, 7) || target > vacation.endDate.slice(0, 7)) return wx.showToast({ title: '已到假期范围边界', icon: 'none' })
    const firstDay = `${target}-01`
    const selectedDate = firstDay < vacation.startDate ? vacation.startDate : firstDay > vacation.endDate ? vacation.endDate : firstDay
    this.setData({ month: target, selectedDate }, () => this.refresh())
  },
  selectDate(e) { const value = e.currentTarget.dataset.date; const vacation = store.getState().vacation; if (value < vacation.startDate || value > vacation.endDate) return; this.setData({ selectedDate: value, month: value.slice(0, 7) }, () => this.refresh()) },
  addTask() { wx.navigateTo({ url: `/pages/task-edit/task-edit?date=${this.data.selectedDate}` }) },
  editTask(e) { const { id, day, displayDay } = e.currentTarget.dataset; wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${id}&occurrenceDate=${day}&displayDate=${displayDay || day}` }) },
  addGoal() { wx.navigateTo({ url: '/pages/goal-edit/goal-edit' }) },
  editGoal(e) { wx.navigateTo({ url: `/pages/goal-edit/goal-edit?id=${e.currentTarget.dataset.id}` }) },
  async toggle(e) { const { id, day, done } = e.currentTarget.dataset; wx.vibrateShort({ type: 'light' }); try { await store.toggleTask(id, day, !done) } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }) } }
})
