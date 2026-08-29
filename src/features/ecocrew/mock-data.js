export const bins = [
  {
    id: 'recycle',
    label: 'Recycle',
    icon: '♻',
    description: 'Clean paper, glass, metal, and accepted plastic.',
  },
  { id: 'compost', label: 'Compost', icon: '♧', description: 'Food scraps and garden waste.' },
  {
    id: 'reuse_return',
    label: 'Return / reuse',
    icon: '↻',
    description: 'Items with a refill, return, or reuse path.',
  },
  {
    id: 'landfill',
    label: 'Landfill',
    icon: '▣',
    description: 'Items that cannot be recovered locally.',
  },
];

export const demoTask = {
  taskId: 'recycle-plastic-bottle',
  taskDay: 'demo-day',
  timezone: 'Asia/Singapore',
  locale: 'en-SG',
  localeRuleVersion: 'sg-demo-v1',
  title: 'Clean Bottle Check',
  instruction:
    'Empty a single-use plastic bottle, recycle it, and take a photo to confirm the action.',
  prompt:
    'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
  targetObject: 'single-use plastic bottle',
  targetMaterial: 'plastic',
  targetAction: 'recycle',
  validationMetadata: { aliases: ['PET bottle', 'water bottle'] },
};

export const demoScans = {
  empty_bottle: {
    itemName: 'Empty plastic drink bottle',
    material: 'PET plastic',
    recommendedBin: 'recycle',
    preparationTip: 'Empty the bottle before recycling.',
    confidence: 0.96,
    localeRuleVersion: 'sg-demo-v1',
    explanation: 'The bottle, preparation state, and recycling bin match today’s mission.',
    taskPrompt:
      'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
    promptSimilarity: 0.96,
    taskSatisfied: true,
    failureReason: null,
    matchesTask: true,
    taskConfidence: 0.96,
    taskReason: 'The empty bottle is held toward the recycling bin.',
  },
  liquid_bottle: {
    itemName: 'Plastic drink bottle with liquid',
    material: 'PET plastic',
    recommendedBin: 'recycle',
    preparationTip: 'Empty the bottle before recycling.',
    confidence: 0.96,
    localeRuleVersion: 'sg-demo-v1',
    explanation: 'The bottle matches the mission, but visible liquid is still inside.',
    taskPrompt:
      'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
    promptSimilarity: 0.96,
    taskSatisfied: false,
    failureReason: 'liquid_present',
    matchesTask: false,
    taskConfidence: 0.96,
    taskReason: 'Empty the bottle first.',
  },
  unrelated_item: {
    itemName: 'Unrelated household item',
    material: 'Unknown',
    recommendedBin: 'landfill',
    preparationTip: null,
    confidence: 0.94,
    localeRuleVersion: 'sg-demo-v1',
    explanation:
      'The image does not show the single-use plastic bottle required by today’s mission.',
    taskPrompt:
      'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
    promptSimilarity: 0.96,
    taskSatisfied: false,
    failureReason: 'unrelated_item',
    matchesTask: false,
    taskConfidence: 0.94,
    taskReason: 'That item does not match today’s mission.',
  },
};

export const demoScan = demoScans.empty_bottle;

export const demoFixtures = [
  { id: 'liquid_bottle', label: 'Bottle with water', icon: '💧' },
  { id: 'empty_bottle', label: 'Empty bottle', icon: '♻️' },
  { id: 'unrelated_item', label: 'Unrelated item', icon: '👟' },
];

/* Kept as the canonical successful fixture for older pages. */
export const successfulDemoScan = {
  itemName: 'Plastic drink bottle',
  material: 'PET plastic',
  recommendedBin: 'recycle',
  preparationTip: 'Empty and rinse the bottle, then replace the cap before recycling.',
  confidence: 0.86,
  localeRuleVersion: 'sg-demo-v1',
  explanation: 'The bottle shape and label match a PET beverage bottle.',
  taskPrompt:
    'The image shows a single use plastic bottle without any liquid inside held up to a recycling bin.',
  promptSimilarity: 0.96,
  taskSatisfied: true,
  failureReason: null,
  matchesTask: true,
  taskConfidence: 0.95,
  taskReason: 'The demo image matches the assigned bottle task.',
};

export const crew = {
  id: 'demo-glass-guardians',
  name: 'Glass Guardians',
  members: [
    { id: 'demo-irfan', name: 'Irfan', initials: 'I', tone: 'moss' },
    { id: 'demo-maya', name: 'Maya', initials: 'M', tone: 'coral' },
    { id: 'demo-noah', name: 'Noah', initials: 'N', tone: 'sky' },
    { id: 'demo-ari', name: 'Ari', initials: 'A', tone: 'sun' },
  ],
  mission: {
    id: 'demo-landfill-monster',
    title: 'Defeat the Landfill Monster',
    progress: 64,
    target: 100,
    endsLabel: '3 days left',
  },
  streak: 4,
  repairTokens: 1,
  weeklyPoints: 745,
};

export const activity = [
  {
    id: 'demo-activity-maya',
    actor: 'Maya',
    action: 'completed a glass jar action',
    time: '18 min ago',
    reactions: 4,
    emoji: '✨',
  },
  {
    id: 'demo-activity-noah',
    actor: 'Noah',
    action: 'helped protect the crew streak',
    time: '2 hr ago',
    reactions: 3,
    emoji: '🔥',
  },
  {
    id: 'demo-activity-irfan',
    actor: 'Irfan',
    action: 'unlocked the Leaf Frame',
    time: 'Yesterday',
    reactions: 6,
    emoji: '🌿',
  },
];

export const leagueRows = [
  { rank: 1, name: 'Bottle Brigade', score: 910, trend: 'up' },
  { rank: 2, name: 'Compost Club', score: 835, trend: 'up' },
  { rank: 3, name: 'The Recyclables', score: 790, trend: 'down' },
  { rank: 4, name: 'Glass Guardians', score: 745, trend: 'you' },
  { rank: 5, name: 'Bin There', score: 710, trend: 'up' },
];

export const cosmetics = [
  {
    id: 'leaf-frame',
    name: 'Leaf Frame',
    kind: 'frame',
    icon: '🌿',
    unlocked: true,
    equipped: true,
  },
  {
    id: 'sprout-badge',
    name: 'Sprout Badge',
    kind: 'badge',
    icon: '🌱',
    unlocked: true,
    equipped: false,
  },
  {
    id: 'mushroom-frame',
    name: 'Mushroom Frame',
    kind: 'frame',
    icon: '🍄',
    unlocked: false,
    progress: '2 more completed actions',
  },
];

export const profile = {
  id: 'mock-user',
  displayName: 'Irfan',
  handle: '@irfan.eco',
  age: null,
  about: '',
  location: 'Singapore',
  avatarId: null,
  frameId: 'leaf-frame',
  joinedLabel: 'EcoCrew member since August 2026',
};
