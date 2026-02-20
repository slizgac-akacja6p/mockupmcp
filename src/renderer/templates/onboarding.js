export const description = 'Onboarding welcome screen with illustration placeholder, headline, and CTA.';

export function generate(screenWidth, screenHeight, _style) {
  const pad = 24;
  const contentWidth = screenWidth - pad * 2;

  // Illustration takes ~35% of screen height
  const illustrationH = Math.floor(screenHeight * 0.35);
  const illustrationY = Math.floor(screenHeight * 0.1);

  const headlineY = illustrationY + illustrationH + 24;
  const subY = headlineY + 48;
  const dotsY = subY + 56;
  const ctaY = dotsY + 32;
  const skipY = ctaY + 56;

  const elements = [
    // Illustration placeholder
    {
      type: 'image',
      x: pad,
      y: illustrationY,
      width: contentWidth,
      height: illustrationH,
      z_index: 0,
      properties: { src: '', alt: 'Welcome illustration' },
    },
    // Headline
    {
      type: 'text',
      x: pad,
      y: headlineY,
      width: contentWidth,
      height: 40,
      z_index: 0,
      properties: { content: 'Welcome to MockupMCP', fontSize: 22, align: 'center' },
    },
    // Subtitle
    {
      type: 'text',
      x: pad,
      y: subY,
      width: contentWidth,
      height: 48,
      z_index: 0,
      properties: { content: 'Design faster with AI-powered UI mockups', fontSize: 15, align: 'center' },
    },
    // Progress dots (represented as text)
    {
      type: 'text',
      x: pad,
      y: dotsY,
      width: contentWidth,
      height: 24,
      z_index: 0,
      properties: { content: '• • •', align: 'center', fontSize: 12 },
    },
    // CTA button
    {
      type: 'button',
      x: pad,
      y: ctaY,
      width: contentWidth,
      height: 48,
      z_index: 0,
      properties: { label: 'Get Started', variant: 'primary' },
    },
    // Skip link
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
