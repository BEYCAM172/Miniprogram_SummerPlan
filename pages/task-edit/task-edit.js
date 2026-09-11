const date = require('../../utils/date')
const model = require('../../services/model')
const store = require('../../services/store')
const taskService = require('../../services/task-service')

const repeatTypes = [{ value: 'once', label: '仅一次' }, { value: 'daily', label: '每天' }, { value: 'weekly', label: '每周' }]

Page({
  data: {
    id: '', occurrenceDate: '', displayDate: '', title: '', date: date.today(), time: '', note: '', goalId: '', goalIndex: 0,
    goalNames: ['不关联目标'], repeatIndex: 0, repeatTypes, weekdays: ['日','一','二','三','四','五','六'].map((label, value) => ({ label, value, selected: false })),
    vacation: {}, editing: false, recurring: false, editScope: 'occurrence', saving: false, deleting: false
  },
  onLoad(options) {
    const state = store.getState()
    const vacation = state.vacation
    const goalNames = ['不关联目标'].concat(state.goals.map(item => item.title))
    const task = options.id && state.tasks.find(item => item._id === options.id)
    if (options.id && !task) {
      wx.showModal({ title: '任务不存在', content: '它可能已在其他设备被删除。', showCancel: false, success: () => wx.navigateBack() })
      return
    }
    if (task) {
      const occurrenceDate = options.occurrenceDate || task.date
      const displayDate = options.displayDate || occurrenceDate
      const instance = model.instancesForDay(state, displayDate).find(item => item._id === task._id && item.occurrenceDate === occurrenceDate) || model.instanceFrom(task, null, occurrenceDate, displayDate)
      const repeatIndex = Math.max(0, repeatTypes.findIndex(item => item.value === (task.repeat && task.repeat.type || 'once')))
      const goalIndex = Math.max(0, state.goals.findIndex(item => item._id === instance.goalId) + 1)
      this.setData({
        id: task._id, occurrenceDate, displayDate, title: instance.title, date: displayDate, time: instance.time || '', note: instance.note || '',
        goalId: goalIndex ? instance.goalId : '', goalIndex, repeatIndex,
        weekdays: this.data.weekdays.map(item => ({ ...item, selected: (task.repeat && task.repeat.weekdays || []).includes(item.value) })),
        vacation, goalNames, editing: true, recurring: task.repeat && task.repeat.type !== 'once'
      })
    } else {
      const requested = options.date || date.today()
      const initialDate = requested < vacation.startDate ? vacation.startDate : requested > vacation.endDate ? vacation.endDate : requested
      this.setData({ date: initialDate, vacation, goalNames })
    }
  },
  back() { if (!this.data.saving && !this.data.deleting) wx.navigateBack() },
  onTitle(e) { this.setData({ title: e.detail.value }) },
  onDate(e) { this.setData({ date: e.detail.value }) },
  onTime(e) { this.setData({ time: e.detail.value }) },
  clearTime() { this.setData({ time: '' }) },
  onNote(e) { this.setData({ note: e.detail.value }) },
  onGoal(e) { const index = Number(e.detail.value); const goals = store.getState().goals; this.setData({ goalIndex: index, goalId: index && goals[index - 1] ? goals[index - 1]._id : '' }) },
  onRepeat(e) { this.setData({ repeatIndex: Number(e.detail.value) }) },
  onScope(e) { if (!this.data.saving) this.setData({ editScope: e.currentTarget.dataset.scope }) },
  toggleWeekday(e) { const value = Number(e.currentTarget.dataset.value); this.setData({ weekdays: this.data.weekdays.map(item => item.value === value ? { ...item, selected: !item.selected } : item) }) },
  async save() {
    if (this.data.saving || this.data.deleting) return
    const title = this.data.title.trim()
    if (!title) return wx.showToast({ title: '请填写任务名称', icon: 'none' })
    const repeat = repeatTypes[this.data.repeatIndex].value
    const weekdays = this.data.weekdays.filter(item => item.selected).map(item => item.value)
    if ((!this.data.recurring || this.data.editScope === 'future') && repeat === 'weekly' && !weekdays.length) return wx.showToast({ title: '请至少选择一天', icon: 'none' })
    const state = store.getState()
    const task = this.data.id && state.tasks.find(item => item._id === this.data.id)
    if (this.data.editing && !task) return wx.showToast({ title: '任务已不存在', icon: 'none' })
    const values = {
      title, date: this.data.date, time: this.data.time, note: this.data.note.trim(), goalId: this.data.goalId,
      repeat: { type: repeat, weekdays: repeat === 'weekly' ? weekdays : [] }, repeatEnd: this.data.vacation.endDate
    }
    this.setData({ saving: true })
    let offline = false
    try {
      if (this.data.recurring && this.data.editScope === 'occurrence') offline = (await taskService.editOccurrence(task, this.data.occurrenceDate, values)).offline
      else if (this.data.recurring) offline = (await taskService.splitFrom(task, this.data.occurrenceDate, values)).offline
      else {
        const existing = task || {}
        const saved = await store.upsert('tasks', { ...existing, _id: this.data.id || undefined, ...values, repeatToVacationEnd: repeat !== 'once' })
        if (this.data.editing) await store.pruneTaskRecords(saved)
      }
    } catch (error) { offline = true }
    wx.showToast({ title: offline ? '已保存到本机，等待同步' : (this.data.editing ? '已保存' : '已添加'), icon: 'none' })
    setTimeout(() => wx.navigateBack(), offline ? 700 : 300)
  },
  confirm(title, content) {
    return new Promise(resolve => wx.showModal({ title, content, confirmColor: '#d83b2d', success: result => resolve(result.confirm), fail: () => resolve(false) }))
  },
  remove() {
    if (this.data.saving || this.data.deleting) return
    const task = store.getState().tasks.find(item => item._id === this.data.id)
    if (!task) return wx.showToast({ title: '任务已不存在', icon: 'none' })
    if (!this.data.recurring) return this.removeOnceTask(task)
    wx.showActionSheet({
      itemList: [`仅删除 ${date.monthDay(this.data.displayDate)}`, `删除 ${date.monthDay(this.data.displayDate)} 及以后`],
      success: result => this.removeRecurring(task, result.tapIndex === 0 ? 'occurrence' : 'future')
    })
  },
  async removeOnceTask(task) {
    if (!await this.confirm('删除任务？', '该任务及其完成记录将被删除。')) return
    this.setData({ deleting: true })
    let offline = false
    try { await store.remove('tasks', task._id) } catch (error) { offline = true }
    wx.showToast({ title: offline ? '已在本机删除，等待同步' : '已删除', icon: 'none' })
    setTimeout(() => wx.navigateBack(), 300)
  },
  async removeRecurring(task, scope) {
    const onlyOne = scope === 'occurrence'
    const confirmed = await this.confirm(onlyOne ? '仅删除本次？' : '删除此次及以后？', onlyOne ? '其他日期的重复任务不受影响。' : '过去的安排和完成记录会保留。')
    if (!confirmed) return
    this.setData({ deleting: true })
    const result = onlyOne ? await taskService.cancelOccurrence(task, this.data.occurrenceDate) : await taskService.truncateFrom(task, this.data.occurrenceDate)
    wx.showToast({ title: result.offline ? '已在本机删除，等待同步' : '已删除', icon: 'none' })
    setTimeout(() => wx.navigateBack(), 300)
  }
})
