// Replace the placeholder images and add real gallery arrays when you have them.
const RAW = [
  {
    id: 'paris', city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522,
    image: '/locations/france.jpg',
    description: 'Home to the Louvre, the world’s largest art museum and a historic monument on the Seine.',
  },
  {
    id: 'tokyo', city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503,
    image: '/locations/japan.jpg',
    description: 'A blend of neon megacity and ancient temples, from Shibuya Crossing to the shrines of Asakusa.',
  },
  {
    id: 'cairo', city: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357,
    image: '/locations/egypt.jpg',
    description: 'Gateway to the Giza pyramids and home to the Egyptian Museum, on the banks of the Nile.',
  },
  {
    id: 'rio', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lng: -43.1729,
    image: '/locations/brazil.jpg',
    description: 'Known for Christ the Redeemer, Sugarloaf Mountain and the beaches of Copacabana and Ipanema.',
  },
  {
    id: 'sydney', city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093,
    image: '/locations/placeholder.jpg',
    description: 'Famous for its harbour, the Opera House and the Harbour Bridge.',
  },
  {
    id: 'nyc', city: 'New York', country: 'United States', lat: 40.7128, lng: -74.006,
    image: '/locations/placeholder.jpg',
    description: 'Central Park, Broadway and the Manhattan skyline, a city that never really sleeps.',
  },
  {
    id: 'singapore', city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198,
    image: '/locations/placeholder.jpg',
    description: 'A garden city-state with hawker centres, Gardens by the Bay and a striking skyline.',
  },
  {
    id: 'cape-town', city: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241,
    image: '/locations/placeholder.jpg',
    description: 'Framed by Table Mountain, with wine lands, coastline, and penguins at Boulders Beach.',
  },
]

// Temporary: every place reuses its hero image in the carousel.
export const DESTINATIONS = RAW.map((d) => ({ gallery: [d.image, d.image, d.image], ...d }))