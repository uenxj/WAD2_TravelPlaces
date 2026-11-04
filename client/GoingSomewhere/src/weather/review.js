import { getActivityConditions } from './api.js'
import { localDate, planningHints, psiCategory } from './conditions.js'
import { planningIssues } from '../planning/review.js'

export async function reviewActivities(activities, { now = new Date(), getConditions = getActivityConditions, budget, externalIssues } = {}) {
  const entries = await Promise.all(activities.map(async activity => {
    try {
      const conditions = await getConditions(activity, now)
      // Seasonal guidance belongs in the overview, not in activity danger warnings.
      const hints = planningHints(activity, conditions.weather?.kind === 'forecast' ? conditions.weather : null, conditions.air)
      const issues = hints.map((hint, index) => ({
        ...hint, id: `weather:${activity.id}:${index}`, source: hint.title.includes('air quality') ? 'air-quality' : 'weather',
        activityIds: [activity.id], title: `${activity.name} · ${activity.startTime}–${activity.endTime}: ${hint.title}`,
      }))
      const clock = new Intl.DateTimeFormat('en-GB', { timeZone: activity.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
      if (activity.environment !== 'indoor' && activity.date === localDate(activity.timezone, now) && activity.startTime <= clock && clock < activity.endTime && conditions.psi?.kind === 'observation' && conditions.psi.value > 100) issues.push({
        id: `psi:${activity.id}`, source: 'psi', level: 'warning', activityIds: [activity.id],
        title: `${activity.name} · ${activity.startTime}–${activity.endTime}: Current Singapore PSI is elevated`,
        text: `Latest 24-hour PSI ${conditions.psi.value} (${psiCategory(conditions.psi.value)}) in the ${conditions.psi.region} region. This activity is happening now; check NEA's current advisory. This is an observation, not an hourly forecast.`,
      })
      return { activity, conditions, issues }
    } catch {
      return { activity, conditions: null, issues: [] }
    }
  }))
  const outdoor = entries.filter(entry => entry.activity.environment !== 'indoor')
  const incomplete = outdoor.filter(({ conditions }) => !conditions || conditions.weather.kind !== 'forecast' || conditions.air.kind !== 'forecast' || conditions.weather.partial || conditions.air.partial)
  const weatherIssues = entries.flatMap(entry => entry.issues)
  return {
    entries, issues: planningIssues(activities, { weatherIssues, budget, externalIssues }),
    outdoorCount: outdoor.length, incompleteCount: incomplete.length,
    coverage: incomplete.map(entry => ({ activityId: entry.activity.id, name: entry.activity.name })),
  }
}
