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

export const crew = {
  name: 'Glass Guardians',
  members: [
    { name: 'Irfan', initials: 'I', tone: 'moss' },
    { name: 'Maya', initials: 'M', tone: 'coral' },
    { name: 'Noah', initials: 'N', tone: 'sky' },
  ],
  mission: { title: 'Defeat the Landfill Monster', progress: 64, target: 100, endsLabel: '3 days left' },
  league: { name: 'Sprout League', rank: 4, total: 12 },
  streak: 4,
  repairTokens: 1,
};

export const activity = [
  { id: 'maya', actor: 'Maya', action: 'sorted a glass pasta jar correctly', time: '18 min ago', reactions: 4, emoji: '✨' },
  { id: 'noah', actor: 'Noah', action: 'helped protect the crew streak', time: '2 hr ago', reactions: 3, emoji: '🔥' },
  { id: 'irfan', actor: 'Irfan', action: 'unlocked the Leaf Frame', time: 'Yesterday', reactions: 6, emoji: '🌿' },
];

export const leagueRows = [
  { rank: 1, name: 'Bottle Brigade', score: 910, trend: 'up' },
  { rank: 2, name: 'Compost Club', score: 835, trend: 'up' },
  { rank: 3, name: 'The Recyclables', score: 790, trend: 'down' },
  { rank: 4, name: 'Glass Guardians', score: 745, trend: 'you' },
  { rank: 5, name: 'Bin There', score: 710, trend: 'up' },
];

export const cosmetics = [
  { id: 'leaf-frame', name: 'Leaf Frame', icon: '🌿', unlocked: true, equipped: true },
  { id: 'sunny-badge', name: 'Sunny Badge', icon: '☀️', unlocked: true, equipped: false },
  { id: 'mushroom-frame', name: 'Mushroom Frame', icon: '🍄', unlocked: false, progress: '2 more correct sorts' },
];
