export const navigation = [
  { label: 'Dashboard', icon: '▦', path: '/' },
  { label: 'Orders & Dispatch', icon: '◇', path: '/orders' },
  { label: 'Riders', icon: '♙', path: '/riders' },
  { label: 'Live Map', icon: '⌖', path: '/map' },
  { label: 'Merchants', icon: '⌂', path: '/merchants' },
  { label: 'Reports', icon: '▥', path: '/reports' },
  { label: 'Hub Management', icon: '▤', path: '/hubs' },
  { label: 'Notifications', icon: '♧', path: '/notifications' },
  { label: 'Settings', icon: '⚙', path: '/settings' },
];

export const stats = [
  { label: 'Deliveries Today', value: '200', detail: 'Across 3 active hubs', note: '67% of 320 target', icon: 'D', tone: 'purple' },
  { label: 'Online Riders', value: '24', detail: '18 available | 6 delivering', note: '6 on delivery', icon: 'R', tone: 'green' },
  { label: 'Avg Response', value: '4.2 min', detail: 'Driver acceptance speed', note: 'Within 7 min target', icon: 'T', tone: 'teal' },
  { label: 'COD in Field', value: 'UGX 1.4M', detail: '26 active COD orders', note: 'Below UGX 5M limit', icon: '$', tone: 'orange' },
  { label: 'Failed Deliveries', value: '4', detail: '2.0% failure rate', note: 'Below 5% target', icon: '!', tone: 'red' },
];

export const performance = [
  ['Avg Pickup-to-Delivery', '42 min', 'Target under 45 min'],
  ['Avg Placement-to-Delivery', '56 min', 'Target under 60 min'],
  ['Avg Driver Response', '4.2 min', 'Target under 7 min'],
  ['Failed Delivery Rate', '2.0%', 'Target under 5%'],
  ['Weekly Completion', '1,164', '24 failed this week'],
];
