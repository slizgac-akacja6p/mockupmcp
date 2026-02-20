export const description = 'Login screen with email/password fields and submit button.';

export function generate(screenWidth, screenHeight, _style) {
  const pad = 24;
  const fieldWidth = screenWidth - pad * 2;
  const centerX = Math.floor(screenWidth / 2);

  return [
    {
      type: 'navbar',
      x: 0,
      y: 0,
      width: screenWidth,
      height: 56,
      z_index: 10,
      properties: { title: 'Sign In' },
    },
    {
      type: 'text',
      x: pad,
      y: 80,
      width: fieldWidth,
      height: 40,
      z_index: 0,
      properties: { content: 'Welcome back', fontSize: 24, align: 'center' },
    },
    {
      type: 'input',
      x: pad,
      y: 140,
      width: fieldWidth,
      height: 56,
      z_index: 0,
      properties: { label: 'Email', placeholder: 'you@example.com', inputType: 'email' },
    },
    {
      type: 'input',
      x: pad,
      y: 216,
      width: fieldWidth,
      height: 56,
      z_index: 0,
      properties: { label: 'Password', placeholder: '••••••••', inputType: 'password' },
    },
    {
      type: 'button',
      x: pad,
      y: 296,
      width: fieldWidth,
      height: 48,
      z_index: 0,
      properties: { label: 'Sign In', variant: 'primary' },
    },
    {
      type: 'text',
      x: pad,
      y: 360,
      width: fieldWidth,
      height: 24,
      z_index: 0,
      properties: { content: 'Forgot password?', align: 'center', fontSize: 14 },
    },
    {
      type: 'text',
      x: pad,
      y: 400,
      width: fieldWidth,
      height: 24,
      z_index: 0,
      properties: { content: "Don't have an account? Sign up", align: 'center', fontSize: 14 },
    },
  ].filter(el => el.y + el.height <= screenHeight);
}
