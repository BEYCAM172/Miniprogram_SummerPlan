const date = require('../../utils/date')
const store = require('../../services/store')
Page({
  data: { id: '', title: '', description: '', deadline: date.today(), color: '#1769ff', colors: ['#1769ff','#16a36a','#e87422','#8257d8','#db3e62'], vacation: {}, editing: false, saving: false },
  onLoad(options) { const state = store.getState(); const goal = options.id && state.goals.find(item => item._id === options.id); if (goal) this.setData({ ...goal, id: goal._id, vacation: state.vacation, editing: true }); else this.setData({ vacation: state.vacation, deadline: state.vacation.endDate }) },
  back() { wx.navigateBack() }, onTitle(e) { this.setData({ title: e.detail.value }) }, onDescription(e) { this.setData({ description: e.detail.value }) }, onDeadline(e) { this.setData({ deadline: e.detail.value }) }, selectColor(e) { this.setData({ color: e.currentTarget.dataset.color }) },
  async save() { const title = this.data.title.trim(); if (!title) return wx.showToast({ title: '请填写目标名称', icon: 'none' }); const existing = this.data.id ? store.getState().goals.find(item => item._id === this.data.id) : {}; this.setData({ saving: true }); try { await store.upsert('goals', { ...existing, _id: this.data.id || undefined, title, description: this.data.description.trim(), deadline: this.data.deadline, color: this.data.color }); wx.showToast({ title: '已保存' }); setTimeout(() => wx.navigateBack(), 250) } catch (error) { wx.showToast({ title: '已离线保存', icon: 'none' }); setTimeout(() => wx.navigateBack(), 500) } },
  remove() { wx.showModal({ title: '删除目标？', content: '目标下的任务会保留，并解除与该目标的关联。', confirmColor: '#d83b2d', success: async res => { if (!res.confirm) return; try { await store.remove('goals', this.data.id) } catch (error) {}; wx.navigateBack() } }) }
})
