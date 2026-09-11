const date = require('../../utils/date')
const store = require('../../services/store')

Page({
  data: { name: '我的暑假', startDate: date.today(), endDate: date.addDays(date.today(), 45), saving: false, editing: false },
  onLoad(options) {
    const vacation = store.getState().vacation
    if (options.edit && vacation) this.setData({ name: vacation.name, startDate: vacation.startDate, endDate: vacation.endDate, editing: true })
  },
  onName(e) { this.setData({ name: e.detail.value }) },
  onStart(e) { this.setData({ startDate: e.detail.value, endDate: e.detail.value > this.data.endDate ? e.detail.value : this.data.endDate }) },
  onEnd(e) { this.setData({ endDate: e.detail.value }) },
  async create(e) {
    if (this.data.saving) return
    if (!this.data.name.trim()) return wx.showToast({ title: '请填写暑假名称', icon: 'none' })
    if (this.data.endDate < this.data.startDate) return wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
    this.setData({ saving: true })
    const state = store.getState()
    const old = state.vacation
    const vacation = { ...(this.data.editing ? old : {}), name: this.data.name.trim(), startDate: this.data.startDate, endDate: this.data.endDate }
    let offline = false
    const attempt = async operation => { try { await operation() } catch (error) { offline = true } }

    if (this.data.editing) {
      const outside = state.tasks.filter(task => {
        const repeatType = task.repeat && task.repeat.type || 'once'
        const taskEnd = repeatType === 'once' ? task.date : task.repeatEnd || old.endDate
        return task.date > vacation.endDate || taskEnd < vacation.startDate
      })
      if (outside.length) {
        const shouldRemove = await new Promise(resolve => wx.showModal({
          title: `发现 ${outside.length} 个范围外任务`,
          content: '保留后暂不显示，重新扩展假期时可以恢复。',
          cancelText: '保留', confirmText: '删除', confirmColor: '#d83b2d',
          success: result => resolve(result.confirm), fail: () => resolve(false)
        }))
        if (shouldRemove) for (const task of outside) await attempt(() => store.remove('tasks', task._id))
      }
    }

    await attempt(() => store.upsert('vacation', vacation))
    if (this.data.editing) {
      const remainingTasks = store.getState().tasks
      for (const task of remainingTasks) {
        const repeatType = task.repeat && task.repeat.type || 'once'
        if (repeatType === 'once') continue
        const followsVacation = task.repeatToVacationEnd === true || (task.repeatToVacationEnd === undefined && task.repeatEnd === old.endDate)
        if (followsVacation) await attempt(() => store.upsert('tasks', { ...task, repeatEnd: vacation.endDate, repeatToVacationEnd: true }))
      }
    }
    if (e.currentTarget.dataset.sample) await attempt(() => store.batch('sample', store.getState().vacation))
    if (offline) wx.showToast({ title: '已保存到本机，等待同步', icon: 'none' })
    setTimeout(() => wx.reLaunch({ url: this.data.editing ? '/pages/profile/profile' : '/pages/today/today' }), offline ? 650 : 100)
  }
})
