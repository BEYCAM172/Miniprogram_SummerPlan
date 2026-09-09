Component({
  data: { selected: 0, list: [
    { url: '/pages/today/today', text: '今天', icon: '⌂' },
    { url: '/pages/plan/plan', text: '计划', icon: '▦' },
    { url: '/pages/profile/profile', text: '我的暑假', icon: '○' }
  ] },
  methods: {
    switchTab(e) { wx.switchTab({ url: e.currentTarget.dataset.url }) },
    add() { wx.navigateTo({ url: '/pages/task-edit/task-edit' }) }
  }
})
