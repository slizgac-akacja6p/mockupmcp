export const description = 'User profile page with avatar, stats, bio, and action buttons.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;

  // Content slots: [0] user name (multi-word only — single generic words like "User" are noise),
  // [1..3] stat labels extracted from description segments.
  // A single-word first hint (e.g. "User" from "user profile") is not a real name — fall back.
  const rawName = contentHints[0] || '';
  const userName = rawName.includes(' ') ? rawName : 'Jane Doe';
  const statLabels = contentHints.length > 1
    ? contentHints.slice(1, 4)
    : ['Posts', 'Followers', 'Following'];
  const statValues = ['48', '1.2k', '305'];

  const elements = [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Profile' },
    },
    {
      type: 'avatar',
      x: Math.floor((screenWidth - 80) / 2),
      y: 72,
      width: 80,
      height: 80,
      z_index: 0,
      properties: { name: userName },
    },
    {
      type: 'text',
      x: pad,
      y: 164,
      width: contentWidth,
      height: 32,
      z_index: 0,
      properties: { content: userName, fontSize: 20, align: 'center' },
    },
    {
      type: 'text',
      x: pad,
      y: 200,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { content: 'Product designer & coffee enthusiast', fontSize: 14, align: 'center' },
    },
    {
      type: 'button',
      x: Math.floor((screenWidth - 160) / 2),
      y: 252,
      width: 160,
      height: 40,
      z_index: 0,
      properties: { label: 'Edit Profile', variant: 'secondary' },
    },
  ];

  // Stats row — up to 3 cards side by side
  const statWidth = Math.floor((contentWidth - pad * 2) / 3);
  for (let i = 0; i < Math.min(statLabels.length, 3); i++) {
    elements.push({
      type: 'card',
      x: pad + i * (statWidth + pad),
      y: 308,
      width: statWidth,
      height: 64,
      z_index: 0,
      properties: { title: statLabels[i], value: statValues[i] || '0' },
    });
  }

  return elements.filter(el => el.x >= 0 && el.y + el.height <= screenHeight);
}
