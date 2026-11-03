// Illustrative itinerary data. Weather uses each trip's city-centre coordinates.
const tokyoDays = [
  ['A day of discovery', 'Asakusa & Shibuya', [
    ['09:00', '11:00', 'Explore Asakusa and Sensō-ji', 'outdoor', 'Stroll through Nakamise Street and the temple grounds.'],
    ['12:30', '13:30', 'Lunch with the group', 'indoor', 'Warm up over ramen at a neighbourhood restaurant.'],
    ['14:30', '16:00', 'Tokyo National Museum', 'indoor', 'Explore Japanese art and history together.'],
    ['17:00', '19:00', 'Evening walk in Shibuya', 'outdoor', 'See the crossing and the neighbourhood lights.'],
  ]],
  ['Gardens, shrines & city lights', 'Harajuku & Shinjuku', [
    ['08:30', '10:00', 'Morning walk at Meiji Shrine', 'outdoor', 'Take the forest path before the city gets busy.'],
    ['10:30', '12:00', 'Browse Takeshita Street', 'mixed', 'Explore small shops and stop for a snack.'],
    ['13:00', '14:00', 'Lunch in Harajuku', 'indoor', 'Take a relaxed lunch break with the group.'],
    ['14:30', '16:00', 'Explore Shinjuku Gyoen', 'outdoor', 'Enjoy the garden paths and winter scenery.'],
    ['18:00', '20:00', 'Shinjuku dinner', 'indoor', 'Try an izakaya and share a few small plates.'],
  ]],
  ['A day by the bay', 'Toyosu & Odaiba', [
    ['09:00', '10:30', 'Breakfast around Toyosu', 'indoor', 'Start with a seafood breakfast and hot tea.'],
    ['11:00', '13:00', 'Immersive art experience', 'indoor', 'Spend the late morning exploring digital installations.'],
    ['14:00', '15:30', 'Odaiba waterfront walk', 'outdoor', 'Take in the skyline and stop for group photos.'],
    ['17:00', '19:00', 'Dinner by the bay', 'indoor', 'Finish the day with a view of the waterfront.'],
  ]],
  ['Old streets & new favourites', 'Ueno & Yanaka', [
    ['09:00', '10:30', 'Walk through Ueno Park', 'outdoor', 'Explore the park at an easy pace.'],
    ['11:00', '12:30', 'Museum visit in Ueno', 'indoor', 'Pick a gallery that matches the group’s interests.'],
    ['13:00', '14:00', 'Lunch near the station', 'indoor', 'Recharge before the afternoon walk.'],
    ['15:00', '17:00', 'Explore Yanaka Ginza', 'mixed', 'Browse local shops and try a street snack.'],
  ]],
  ['Views from above', 'Tokyo Tower & Ginza', [
    ['09:30', '11:00', 'Visit Zōjō-ji grounds', 'outdoor', 'Enjoy the temple grounds with Tokyo Tower in the background.'],
    ['11:30', '13:00', 'Tokyo Tower observation deck', 'indoor', 'Look out over the city and find places you have visited.'],
    ['14:00', '16:00', 'Ginza cafés and shops', 'mixed', 'Split into small groups and meet again for coffee.'],
    ['18:00', '20:00', 'Farewell group dinner', 'indoor', 'Celebrate the trip and share favourite moments.'],
  ]],
  ['One last taste of Tokyo', 'Tokyo Station & departure', [
    ['08:30', '09:30', 'Breakfast near the hotel', 'indoor', 'Enjoy a slow start and finish packing.'],
    ['10:00', '11:30', 'Souvenirs at Tokyo Station', 'indoor', 'Pick up small gifts and snacks for home.'],
    ['12:00', '13:00', 'Final lunch together', 'indoor', 'Meet for one last meal before departure.'],
    ['14:00', '16:00', 'Travel to the airport', 'mixed', 'Leave time for the transfer and airport check-in.'],
  ]],
]
const parisDays = [
  ['A day of discovery', 'The Louvre & Montmartre', [
    ['09:00', '11:30', 'Visit the Louvre', 'indoor', 'Choose a few galleries to explore at a relaxed pace.'],
    ['12:30', '13:30', 'Lunch near the Seine', 'indoor', 'Stop at a café and plan the afternoon.'],
    ['15:00', '17:00', 'Explore Montmartre', 'outdoor', 'Wander the hillside streets and enjoy the city views.'],
    ['18:00', '19:30', 'Dinner in the neighbourhood', 'indoor', 'Settle into your first evening in Paris.'],
  ]],
  ['Landmarks along the Seine', 'Eiffel Tower & riverbanks', [
    ['09:00', '10:30', 'Champ de Mars walk', 'outdoor', 'See the Eiffel Tower from the gardens.'],
    ['11:00', '12:30', 'Eiffel Tower visit', 'mixed', 'Take time for the views and photographs.'],
    ['13:00', '14:00', 'Bistro lunch', 'indoor', 'Rest and warm up before the afternoon.'],
    ['15:00', '17:00', 'Walk along the Seine', 'outdoor', 'Follow the river and stop at a riverside bookstall.'],
  ]],
  ['Art & garden paths', 'Musée d’Orsay & Saint-Germain', [
    ['09:30', '12:00', 'Explore Musée d’Orsay', 'indoor', 'Spend the morning with Impressionist art.'],
    ['12:30', '13:30', 'Lunch in Saint-Germain', 'indoor', 'Find a neighbourhood café for lunch.'],
    ['14:30', '16:00', 'Luxembourg Gardens', 'outdoor', 'Enjoy a relaxed afternoon walk.'],
    ['17:00', '18:30', 'Bookshops and hot chocolate', 'indoor', 'Browse a bookshop and take a café break.'],
  ]],
  ['A day at Versailles', 'Palace & gardens', [
    ['08:30', '10:00', 'Travel to Versailles', 'mixed', 'Allow time for the train and a short walk.'],
    ['10:30', '12:30', 'Palace visit', 'indoor', 'Explore the palace interiors together.'],
    ['13:00', '14:00', 'Lunch break', 'indoor', 'Take a break before heading outside.'],
    ['14:30', '16:30', 'Versailles gardens', 'outdoor', 'Stroll through the garden paths at your own pace.'],
  ]],
  ['Markets & hidden corners', 'Le Marais & Bastille', [
    ['09:00', '10:30', 'Breakfast and market browsing', 'mixed', 'Start the day with pastries and local produce.'],
    ['11:00', '12:30', 'Place des Vosges', 'outdoor', 'Explore the square and surrounding streets.'],
    ['13:00', '14:00', 'Lunch in Le Marais', 'indoor', 'Meet for a casual neighbourhood lunch.'],
    ['15:00', '17:00', 'Gallery and boutique visits', 'indoor', 'Pick small galleries and shops to explore.'],
  ]],
  ['Island walks & a final toast', 'Île de la Cité & Latin Quarter', [
    ['09:00', '10:30', 'Walk around Île de la Cité', 'outdoor', 'See the island streets and riverside views.'],
    ['11:00', '12:00', 'Sainte-Chapelle visit', 'indoor', 'Take in the stained-glass interior.'],
    ['13:00', '14:30', 'Lunch in the Latin Quarter', 'indoor', 'Relax over lunch and swap travel photos.'],
    ['15:00', '17:00', 'Explore the Latin Quarter', 'mixed', 'Browse bookshops and wander the side streets.'],
    ['19:00', '21:00', 'Farewell dinner', 'indoor', 'Celebrate a week of exploring together.'],
  ]],
  ['A slow Paris goodbye', 'Cafés & departure', [
    ['08:30', '09:30', 'Breakfast at a favourite café', 'indoor', 'Return for one last coffee and croissant.'],
    ['10:00', '11:30', 'Souvenir shopping', 'indoor', 'Pick up gifts and finish packing.'],
    ['12:00', '13:00', 'Final neighbourhood stroll', 'outdoor', 'Enjoy a short walk before leaving.'],
    ['14:00', '16:00', 'Travel to the airport', 'mixed', 'Allow time for transfers and check-in.'],
  ]],
]
function itinerary(trip, rows) {
  return { ...trip, days: rows.map(([title, area, items], dayIndex) => {
    const date = new Date(`${trip.startDate}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + dayIndex)
    const dayDate = date.toISOString().slice(0, 10)
    return { date: dayDate, title, area, activities: items.map(([startTime, endTime, name, environment, description], index) => ({
      id: `preview-${trip.id}-${dayIndex + 1}-${index + 1}`, date: dayDate, name, description, startTime, endTime, environment,
      latitude: trip.latitude, longitude: trip.longitude, timezone: trip.timezone,
    })) }
  }) }
}
export const SAMPLE_TRIPS = [
  itinerary({ id: 'tokyo', name: 'Tokyo with friends', place: 'Tokyo, Japan', dates: '12–17 December 2026', startDate: '2026-12-12', members: '4 travellers', role: 'Organiser', image: '/locations/japan.jpg', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' }, tokyoDays),
  itinerary({ id: 'paris', name: 'A week in Paris', place: 'Paris, France', dates: '8–14 March 2027', startDate: '2027-03-08', members: '2 travellers', role: 'Member', image: '/locations/france.jpg', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' }, parisDays),
]
