export const description = 'Onboarding welcome screen with illustration placeholder, headline, and CTA.';

export function generate(screenWidth, screenHeight, _style, contentHints = []) {
  const pad = 24;
  const contentWidth = screenWidth - pad * 2;

  // Content slots: [0] headline, [1] subtitle
  const headline = contentHints[0] || 'Welcome to MockupMCP';
  const subtitle = contentHints[1] || 'Design faster with AI-powered UI mockups';

  const illustrationH = Math.floor(screenHeight * 0.35);
  const illustrationY = Math.floor(screenHeight * 0.1);

  const headlineY = illustrationY + illustrationH + 24;
  const subY = headlineY + 48;
  const dotsY = subY + 56;
  const ctaY = dotsY + 32;
  const skipY = ctaY + 56;

  const elements = [
    {
      type: 'image',
      x: pad,
      y: illustrationY,
      width: contentWidth,
      height: illustrationH,
      z_index: 0,
      properties: { src: '', alt: 'Welcome illustration' },
    },
    {
      type: 'text',
      x: pad,
      y: headlineY,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { content: headline, fontSize: 22, align: 'center' },
    },
    {
      type: 'text',
      x: pad,
      y: subY,
      width: contentWidth,
      height: 48,
      z_index: 0,
      properties: { content: subtitle, fontSize: 15, align: 'center' },
    },
    {
      type: 'text',
      x: pad,
      y: dotsY,
      width: contentWidth,
      height: 24,
      z_index: 0,
      properties: { content: '• • •', align: 'center', fontSize: 12 },
    },
    {
      type: 'button',
      x: pad,
      y: ctaY,
      width: contentWidth,
      height: 48,
      z_index: 0,
      properties: { label: 'Get Started', variant: 'primary' },
    },
    {
      type: 'text',
      x: pad,
      y: skipY,
      width: contentWidth,
      height: 32,
      z_index: 0,
      properties: { content: 'Skip', align: 'center', fontSize: 14 },
    },
  ];

  return elements.filter(el => el.y + el.height <= screenHeight);
}
