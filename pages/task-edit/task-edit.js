const date = require('../../utils/date')
const store = require('../../services/store')
const repeatTypes = [{ value: 'once', label: '仅一次' }, { value: 'daily', label: '每天' }, { value: 'weekly', label: '每周' }]
Page({
  data: { id: '', title: '', date: date.today(), time: '', note: '', goalId: '', goalIndex: 0, goalNames: ['不关联目标'], repeatIndex: 0, repeatTypes, weekdays: ['日','一','二','三','四','五','六'].map((label, value) => ({ label, value, selected: false })), vacation: {}, editing: false, saving: false },
  onLoad(options) {
    const state = store.getState(); const vacation = state.vacation
    const goalNames = ['不关联目标'].concat(state.goals.map(item => item.title))
    const task = options.id && state.tasks.find(item => item._id === options.id)
    if (task) {
      const repeatIndex = repeatTypes.findIndex(item => item.value === (task.repeat && task.repeat.type || 'once'))
      this.setData({ id: task._id, title: task.title, date: task.date, time: task.time || '', note: task.note || '', goalId: task.goalId || '', goalIndex: Math.max(0, state.goals.findIndex(item => item._id === task.goalId) + 1), repeatIndex, weekdays: this.data.weekdays.map(item => ({ ...item, selected: (task.repeat.weekdays || []).includes(item.value) })), vacation, goalNames, editing: true })
    } else {
      const requested = options.date || date.today()
      const initialDate = requested < vacation.startDate ? vacation.startDate : requested > vacation.endDate ? vacation.endDate : requested
      this.setData({ date: initialDate, vacation, goalNames })
    }
  },
  back() { wx.navigateBack() },
  onTitle(e) { this.setData({ title: e.detail.value }) }, onDate(e) { this.setData({ date: e.detail.value }) }, onTime(e) { this.setData({ time: e.detail.value }) }, clearTime() { this.setData({ time: '' }) }, onNote(e) { this.setData({ note: e.detail.value }) },
  onGoal(e) { const index = Number(e.detail.value); const goals = store.getState().goals; this.setData({ goalIndex: index, goalId: index ? goals[index - 1]._id : '' }) },
  onRepeat(e) { this.setData({ repeatIndex: Number(e.detail.value) }) },
  toggleWeekday(e) { const value = Number(e.currentTarget.dataset.value); this.setData({ weekdays: this.data.weekdays.map(item => item.value === value ? { ...item, selected: !item.selected } : item) }) },
  async save() {
    const title = this.data.title.trim(); if (!title) return wx.showToast({ title: '请填写任务名称', icon: 'none' })
    const repeat = repeatTypes[this.data.repeatIndex].value
    const weekdays = this.data.weekdays.filter(item => item.selected).map(item => item.value)
    if (repeat === 'weekly' && !weekdays.length) return wx.showToast({ title: '请至少选择一天', icon: 'none' })
    const existing = this.data.id ? store.getState().tasks.find(item => item._id === this.data.id) : {}
    this.setData({ saving: true })
    try {
      const saved = await store.upsert('tasks', { ...existing, _id: this.data.id || undefined, title, date: this.data.date, time: this.data.time, note: this.data.note.trim(), goalId: this.data.goalId, repeat: { type: repeat, weekdays: repeat === 'weekly' ? weekdays : [] }, repeatEnd: this.data.vacation.endDate })
      if (this.data.editing) await store.pruneTaskRecords(saved)
      wx.showToast({ title: this.data.editing ? '已保存' : '已添加' }); setTimeout(() => wx.navigateBack(), 250)
    } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }); setTimeout(() => wx.navigateBack(), 500) }
  },
  remove() { wx.showModal({ title: '删除任务？', content: '重复任务的全部安排和完成记录也将不再显示。', confirmColor: '#d83b2d', success: async res => { if (!res.confirm) return; try { await store.remove('tasks', this.data.id) } catch (error) {}; wx.navigateBack() } }) }
})
