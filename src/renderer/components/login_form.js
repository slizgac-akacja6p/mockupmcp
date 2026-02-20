import { render as renderInput } from './input.js';
import { render as renderButton } from './button.js';
import { escapeHtml } from './utils.js';

export function defaults() {
  return {
    title:             'Sign In',
    emailLabel:        'Email',
    passwordLabel:     'Password',
    buttonLabel:       'Sign In',
    showForgotPassword: true,
  };
}

export function render(props) {
  const p = { ...defaults(), ...props };
  const forgotHtml = p.showForgotPassword
    ? `<div class="mockup-login__forgot">Forgot password?</div>`
    : '';

  return `<div class="mockup-login">
    <h2 class="mockup-login__title">${escapeHtml(String(p.title))}</h2>
    <div class="mockup-login__field">${renderInput({ label: p.emailLabel, placeholder: 'email@example.com', type: 'email', _style: p._style })}</div>
    <div class="mockup-login__field">${renderInput({ label: p.passwordLabel, placeholder: '********', type: 'password', _style: p._style })}</div>
    ${forgotHtml}
    <div class="mockup-login__action">${renderButton({ label: p.buttonLabel, variant: 'primary', size: 'lg', _style: p._style })}</div>
  </div>`;
}
