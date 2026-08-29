export const bins = [
  { id: 'recycle', label: 'Recycle', icon: '♻', description: 'Clean paper, glass, metal, and accepted plastic.' },
  { id: 'compost', label: 'Compost', icon: '♧', description: 'Food scraps and garden waste.' },
  { id: 'reuse', label: 'Return / reuse', icon: '↻', description: 'Items with a refill, return, or reuse path.' },
  { id: 'landfill', label: 'Landfill', icon: '▣', description: 'Items that cannot be recovered locally.' },
];

export const demoScan = {
  id: 'demo-bottle-01',
  itemName: 'Plastic drink bottle',
  material: 'PET plastic',
  recommendedBin: 'recycle',
  preparationTip: 'Empty and rinse the bottle, then replace the cap before recycling.',
  confidence: 0.86,
  reason: 'The bottle shape and label match a PET beverage bottle.',
};

export const dailyTasks = [
  { id: 'water-plant', title: 'Water a plant', guidance: 'Give one of your plants the care it needs today.' },
  { id: 'plant-seed', title: 'Plant a seed', guidance: 'Start something new by planting a seed.' },
  { id: 'plant-tree', title: 'Plant a tree', guidance: 'Help grow a greener future by planting a tree.' },
  { id: 'recycle-plastic-bottle', title: 'Put a plastic bottle into a recycling bin', guidance: 'Empty and rinse the bottle before placing it in recycling.' },
  { id: 'recycle-paper-cardboard', title: 'Put paper or cardboard into a recycling bin', guidance: 'Keep it clean and dry before recycling it.' },
  { id: 'separate-recyclables', title: 'Separate recyclables into different bins', guidance: 'Sort materials so they can be recovered correctly.' },
  { id: 'reusable-water-bottle', title: 'Carry a reusable water bottle', guidance: 'Choose your reusable bottle instead of a disposable one.' },
  { id: 'reusable-shopping-bag', title: 'Use a reusable shopping bag', guidance: 'Bring a reusable bag for your shopping trip.' },
  { id: 'return-bottles-cans', title: 'Return bottles or cans to a collection point', guidance: 'Send drink containers back through the right collection stream.' },
  { id: 'pick-up-litter', title: 'Pick up litter', guidance: 'Safely pick up litter and dispose of it properly.' },
  { id: 'dispose-litter', title: 'Dispose of litter in a bin', guidance: 'Keep shared spaces clean by using a bin.' },
  { id: 'reusable-takeaway-container', title: 'Bring reusable containers for takeaway food', guidance: 'Skip single-use packaging for your takeaway meal.' },
  { id: 'reusable-cafe-cup', title: 'Use a reusable cup at a café', guidance: 'Bring your own cup for your next café drink.' },
];

export const crew = {
  name: 'Glass Guardians',
  members: [
    { name: 'Irfan', initials: 'I', tone: 'moss' },
    { name: 'Maya', initials: 'M', tone: 'coral' },
    { name: 'Noah', initials: 'N', tone: 'sky' },
  ],
  streak: 4,
};

export const activity = [
  { id: 'maya', actor: 'Maya', action: 'watered a plant and shared photo evidence', time: '18 min ago', reactions: 4, emoji: '✨' },
  { id: 'noah', actor: 'Noah', action: 'used a reusable cup and protected the crew streak', time: '2 hr ago', reactions: 3, emoji: '🔥' },
  { id: 'irfan', actor: 'Irfan', action: 'unlocked the Leaf Frame', time: 'Yesterday', reactions: 6, emoji: '🌿' },
];

export const leagues = [
  {
    id: 'nus',
    name: 'NUS League',
    total: 12,
    minimumMembers: 3,
    rows: [
      { rank: 1, name: 'School of Computing', score: 910, trend: 'up' },
      { rank: 2, name: 'College of Design and Engineering', score: 835, trend: 'up' },
      { rank: 3, name: 'Faculty of Science', score: 790, trend: 'down' },
      { rank: 4, name: 'Glass Guardians', score: 745, trend: 'you' },
      { rank: 5, name: 'NUS Business School', score: 710, trend: 'up' },
    ],
  },
  {
    id: 'sutd',
    name: 'SUTD League',
    total: 10,
    minimumMembers: 3,
    rows: [
      { rank: 1, name: 'Block 51', score: 895, trend: 'up' },
      { rank: 2, name: 'Block 53', score: 840, trend: 'up' },
      { rank: 3, name: 'Block 55', score: 780, trend: 'down' },
      { rank: 4, name: 'Glass Guardians', score: 745, trend: 'you' },
      { rank: 5, name: 'Block 57', score: 705, trend: 'up' },
      { rank: 6, name: 'Block 59', score: 650, trend: 'down' },
    ],
  },
];

export const cosmetics = [
  { id: 'leaf-frame', name: 'Leaf Frame', icon: '🌿', unlocked: true, equipped: true },
  { id: 'sunny-badge', name: 'Sunny Badge', icon: '☀️', unlocked: true, equipped: false },
  { id: 'mushroom-frame', name: 'Mushroom Frame', icon: '🍄', unlocked: false, progress: '2 more completed tasks' },
];

export const profile = {
  name: 'Irfan',
  handle: '@irfan.eco',
  age: 21,
  about: 'I am learning to make low-waste choices one small habit at a time. I am here for the crew energy, tiny wins, and a cleaner Singapore.',
  location: 'Singapore',
  joinedLabel: 'EcoCrew member since August 2026',
  totalPoints: 1280,
  longestStreak: 8,
  avatar: 'I',
};
