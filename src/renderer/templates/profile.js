export const description = 'User profile page with avatar, stats, bio, and action buttons.';

export function generate(screenWidth, screenHeight, _style) {
  const pad = 16;
  const contentWidth = screenWidth - pad * 2;
  const centerX = pad;

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
    // Avatar
    {
      type: 'avatar',
      x: Math.floor((screenWidth - 80) / 2),
      y: 72,
      width: 80,
      height: 80,
      z_index: 0,
      properties: { name: 'Jane Doe' },
    },
    // Name
    {
      type: 'text',
      x: pad,
      y: 164,
      width: contentWidth,
      height: 32,
      z_index: 0,
      properties: { content: 'Jane Doe', fontSize: 20, align: 'center' },
    },
    // Bio
    {
      type: 'text',
      x: pad,
      y: 200,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { content: 'Product designer & coffee enthusiast', fontSize: 14, align: 'center' },
    },
    // Edit profile button
    {
      type: 'button',
      x: Math.floor((screenWidth - 160) / 2),
      y: 252,
      width: 160,
      height: 40,
      z_index: 0,
      properties: { label: 'Edit Profile', variant: 'secondary' },
    },
    // Stats row — three cards side by side
    {
      type: 'card',
      x: pad,
      y: 308,
      width: Math.floor((contentWidth - pad * 2) / 3),
      height: 64,
      z_index: 0,
      properties: { title: 'Posts', value: '48' },
    },
    {
      type: 'card',
      x: pad + Math.floor((contentWidth - pad * 2) / 3) + pad,
      y: 308,
      width: Math.floor((contentWidth - pad * 2) / 3),
      height: 64,
      z_index: 0,
      properties: { title: 'Followers', value: '1.2k' },
    },
    {
      type: 'card',
      x: pad + Math.floor((contentWidth - pad * 2) / 3) * 2 + pad * 2,
      y: 308,
      width: Math.floor((contentWidth - pad * 2) / 3),
      height: 64,
      z_index: 0,
      properties: { title: 'Following', value: '305' },
    },
  ];

  return elements.filter(el => el.x >= 0 && el.y + el.height <= screenHeight);
}
