const date = require('../utils/date')
const model = require('./model')
const stats = require('./stats')

function completedByDay(state, current) {
  if (!state.vacation || current < state.vacation.startDate) return []
  const end = current < state.vacation.endDate ? current : state.vacation.endDate
  return date.eachDay(state.vacation.startDate, end).map(day => {
    const items = model.instancesForDay(state, day)
    const done = items.filter(item => item.done)
    return { day, label: date.monthDay(day), total: items.length, done: done.length, items: done }
  })
}

function weeklyTrend(days, vacationStart) {
  const groups = []
  days.forEach(item => {
    const index = Math.floor(date.diffDays(vacationStart, item.day) / 7)
    if (!groups[index]) groups[index] = { index, done: 0, total: 0 }
    groups[index].done += item.done
    groups[index].total += item.total
  })
  return groups.filter(Boolean).slice(-6).map(item => {
    const percent = item.total ? Math.round(item.done / item.total * 100) : 0
    return { ...item, label: `第${item.index + 1}周`, percent, height: Math.max(6, percent) }
  })
}

function buildReport(state, current = date.today()) {
  const vacation = state.vacation
  if (!vacation) return null
  const summary = stats.summary(state, current)
  const days = completedByDay(state, current)
  const dueItems = days.flatMap(item => item.items)
  const activeDays = days.filter(item => item.done > 0).length
  const bestDay = days.slice().sort((a, b) => b.done - a.done || (b.total ? b.done / b.total : 0) - (a.total ? a.done / a.total : 0) || b.day.localeCompare(a.day))[0]
  const goals = (state.goals || []).map(goal => {
    const progress = stats.goalProgress(state, goal._id, current)
    return { ...goal, progress }
  }).sort((a, b) => b.progress.done - a.progress.done || b.progress.percent - a.progress.percent)
  const topGoal = goals.find(goal => goal.progress.done > 0) || goals[0] || null
  const earlyCount = dueItems.filter(item => item.time && item.time <= '09:30').length
  const comebackCount = (state.records || []).filter(record => record.done && record.rescheduledTo).length
  const achievements = [
    { key: 'first', icon: '✓', name: '迈出第一步', description: '完成第一个暑期任务', unlocked: summary.dueDone >= 1 },
    { key: 'ten', icon: '↗', name: '渐入佳境', description: '累计完成 10 项任务', unlocked: summary.dueDone >= 10 },
    { key: 'streak', icon: '🔥', name: '连续行动', description: '连续完成计划 3 天', unlocked: summary.streak >= 3 },
    { key: 'early', icon: '☀', name: '晨光执行者', description: '上午 9:30 前完成 5 项', unlocked: earlyCount >= 5 },
    { key: 'goal', icon: '◆', name: '目标达成', description: '完成一个阶段目标', unlocked: goals.some(goal => goal.progress.total > 0 && goal.progress.percent === 100) },
    { key: 'comeback', icon: '⟳', name: '重新出发', description: '完成一项重新安排的任务', unlocked: comebackCount >= 1 }
  ]
  const status = current < vacation.startDate ? 'upcoming' : current > vacation.endDate ? 'finished' : 'active'
  let narrative
  if (status === 'upcoming') narrative = `${vacation.name}还没有开始。计划已经就位，第一步是按时完成第一个任务。`
  else if (!summary.due) narrative = '目前还没有到期任务。添加一些真正想完成的小事，让这段暑假开始留下轨迹。'
  else if (!summary.dueDone) narrative = `计划已经开始，共有 ${summary.due} 项任务等待行动。先完成今天最小的一件事，就能点亮第一枚成就。`
  else narrative = `你已经在 ${activeDays} 天里完成 ${summary.dueDone} 项任务。${bestDay && bestDay.done ? `${bestDay.label}状态最好，一共完成 ${bestDay.done} 项。` : ''}${topGoal && topGoal.progress.done ? `投入最多的目标是“${topGoal.title}”。` : ''}`
  const shareText = `${vacation.name}进行到 ${stats.vacationProgress(vacation, current).percent}%：已完成 ${summary.dueDone} 项任务，当前完成率 ${summary.percent}%，连续行动 ${summary.streak} 天。`
  return {
    status,
    generatedDate: `${date.monthDay(current)}生成`,
    vacation,
    progress: stats.vacationProgress(vacation, current),
    summary: { ...summary, activeDays },
    bestDay: bestDay && bestDay.done ? bestDay : null,
    topGoal,
    earlyCount,
    comebackCount,
    trend: weeklyTrend(days, vacation.startDate),
    achievements,
    unlockedCount: achievements.filter(item => item.unlocked).length,
    narrative,
    shareText
  }
}

module.exports = { completedByDay, weeklyTrend, buildReport }
