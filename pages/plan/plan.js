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
    const tasks = model.instancesForDay(state, this.data.selectedDate)
    const goals = state.goals.map(goal => ({ ...goal, progress: stats.goalProgress(state, goal._id), deadlineText: date.monthDay(goal.deadline) }))
    this.setData({ monthLabel: calendar.monthLabel(this.data.month), cells: calendar.monthGrid(this.data.month, this.data.selectedDate, state, model.instancesForDay), tasks, goals })
  },
  switchView(e) { this.setData({ tab: e.currentTarget.dataset.tab }) },
  previousMonth() { this.setData({ month: calendar.shiftMonth(this.data.month, -1) }, () => this.refresh()) },
  nextMonth() { this.setData({ month: calendar.shiftMonth(this.data.month, 1) }, () => this.refresh()) },
  selectDate(e) { const value = e.currentTarget.dataset.date; this.setData({ selectedDate: value, month: value.slice(0, 7) }, () => this.refresh()) },
  addTask() { wx.navigateTo({ url: `/pages/task-edit/task-edit?date=${this.data.selectedDate}` }) },
  editTask(e) { wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${e.currentTarget.dataset.id}` }) },
  addGoal() { wx.navigateTo({ url: '/pages/goal-edit/goal-edit' }) },
  editGoal(e) { wx.navigateTo({ url: `/pages/goal-edit/goal-edit?id=${e.currentTarget.dataset.id}` }) },
  async toggle(e) { const { id, day, done } = e.currentTarget.dataset; wx.vibrateShort({ type: 'light' }); try { await store.toggleTask(id, day, !done) } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }) } }
})
