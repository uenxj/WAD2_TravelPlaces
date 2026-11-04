// Common issue contract for itinerary, weather, budget and schedule integrations.
// Costs must already be in the budget's home currency (estimatedCostHome).
export function planningIssues(activities, { weatherIssues = [], budget = null, externalIssues = [] } = {}) {
  const issues = [...weatherIssues, ...externalIssues]
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i]
    for (const b of activities.slice(i + 1)) {
      // Separate traveller calendars may intentionally overlap; only compare shared agendas.
      if (a.agendaId !== b.agendaId || a.date !== b.date || a.timezone !== b.timezone) continue
      if (a.startTime < b.endTime && b.startTime < a.endTime) issues.push({
        id: `schedule:${a.id}:${b.id}`, source: 'schedule', level: 'warning', activityIds: [a.id, b.id],
        title: 'Activities overlap', text: `${a.name} (${a.startTime}–${a.endTime}) overlaps ${b.name} (${b.startTime}–${b.endTime}). Adjust a time before planning the route.`,
      })
    }
  }
  if (new Set(activities.map(a => a.timezone)).size > 1) issues.push({ id: 'schedule:timezones', source: 'schedule', level: 'info', activityIds: [], title: 'Cross-timezone schedule needs review', text: 'These activities use different local timezones. Compare travel times in the itinerary builder before confirming the schedule.' })
  if (budget && Number.isFinite(budget.total) && Number.isFinite(budget.spentTotal)) {
    const remainingActivities = activities.filter(a => !a.completed)
    const estimated = remainingActivities.reduce((sum, a) => sum + (Number.isFinite(a.estimatedCostHome) && a.estimatedCostHome >= 0 ? a.estimatedCostHome : 0), 0)
    const projected = budget.spentTotal + estimated
    if (projected > budget.total) issues.push({
      id: 'budget:overrun', source: 'budget', level: 'warning', activityIds: [], title: 'Trip budget may be exceeded',
      text: `${budget.homeCurrency} ${projected.toFixed(2)} spent and estimated, against a ${budget.homeCurrency} ${budget.total.toFixed(2)} budget. Review costs before replacing an activity.`,
    })
  }
  return issues
}
