// Plug-in points for your teammates' features.
// Each function may return null/undefined = "no information, don't flag anything".
// Conflict detection works without them, so you can demo before they are ready.

// Route Planner teammate: return travel time in minutes between two items
// (use their Google Routes API wrapper). Both items have item.location.lat / lng.
async function getTravelMinutes(fromItem, toItem) {
  return null;
}

// Weather/Haze teammate: return { unsafe: true, reason: 'PSI 112 (unhealthy)' }
// for an outdoor item on that date/location, otherwise { unsafe: false }.
//
// Everything you need is in item.weather (built by toWeatherActivity in itineraryLogic.js):
//   { id, coordinates: {lat,lng}|null, coordinatesFrom: 'activity'|'destination'|null,
//     timezone: 'Asia/Singapore'|null, startLocal: '2026-11-07T10:00', endLocal, setting }
// Skip items with no coordinates or timezone by returning null ("no information, don't flag anything").
// Forecast APIs only look a couple of weeks ahead, so also return null for dates further out.
// Example for Open-Meteo: pass latitude/longitude and timezone=<weather.timezone>; the hourly times it returns
// are local to that timezone in the same 'YYYY-MM-DDTHH:mm' format as startLocal, so they can be compared directly.
async function getWeatherFlag(item) {
  return null;
}

const externalChecks = { getTravelMinutes, getWeatherFlag };

module.exports = { getTravelMinutes, getWeatherFlag, externalChecks };
