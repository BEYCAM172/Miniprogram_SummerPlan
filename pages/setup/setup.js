const date = require('../../utils/date')
const store = require('../../services/store')
Page({
  data: { name: '我的暑假', startDate: date.today(), endDate: date.addDays(date.today(), 45), saving: false, editing: false },
  onLoad(options) { const v=store.getState().vacation; if(options.edit && v) this.setData({ name:v.name,startDate:v.startDate,endDate:v.endDate,editing:true }) },
  onName(e) { this.setData({ name: e.detail.value }) },
  onStart(e) { this.setData({ startDate: e.detail.value, endDate: e.detail.value > this.data.endDate ? e.detail.value : this.data.endDate }) },
  onEnd(e) { this.setData({ endDate: e.detail.value }) },
  async create(e) {
    if (!this.data.name.trim()) return wx.showToast({ title: '请填写暑假名称', icon: 'none' })
    if (this.data.endDate < this.data.startDate) return wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
    this.setData({ saving: true })
    const old=store.getState().vacation
    const vacation = { ...(this.data.editing?old:{}), name: this.data.name.trim(), startDate: this.data.startDate, endDate: this.data.endDate }
    try {
      if(this.data.editing){
        const outside=store.getState().tasks.filter(t=>(t.repeat.type==='once'&&(t.date<this.data.startDate||t.date>this.data.endDate))||(t.repeat.type!=='once'&&t.date>this.data.endDate))
        if(outside.length){
          const remove=await new Promise(resolve=>wx.showModal({title:`发现 ${outside.length} 个范围外任务`,content:'保留后暂不显示，延长假期时可恢复。',cancelText:'保留',confirmText:'删除',confirmColor:'#d83b2d',success:r=>resolve(r.confirm)}))
          if(remove) for(const task of outside){ try{ await store.remove('tasks',task._id) }catch(error){} }
        }
      }
      await store.upsert('vacation', vacation)
      if(this.data.editing){
        const repeating=store.getState().tasks.filter(t=>t.repeat.type!=='once'&&t.date<=this.data.endDate)
        for(const task of repeating){ try{ await store.upsert('tasks',{...task,repeatEnd:this.data.endDate}) }catch(error){} }
      }
      if (e.currentTarget.dataset.sample) await store.batch('sample', store.getState().vacation)
    } catch (error) { wx.showToast({ title: '已离线保存，联网后同步', icon: 'none' }) }
    wx.reLaunch({ url: this.data.editing ? '/pages/profile/profile' : '/pages/today/today' })
  }
})
