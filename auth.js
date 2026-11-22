// ══════════════════════════════════════
//  auth.js — Registration, Login, OTP, Reset
// ══════════════════════════════════════

function switchAuthTab(tab) {
  ['login', 'register', 'otp', 'forgot', 'reset', 'admin'].forEach(t => {
    const el = document.getElementById('auth-' + t);
    if (el) el.style.display = 'none';
  });
  document.getElementById('auth-' + tab).style.display = 'block';

  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.querySelector(`.auth-tab[onclick*="${tab}"]`);
  if (tabEl) tabEl.classList.add('active');

  const titles = {
    login:    'Welcome Back',
    register: 'Create Account',
    otp:      'Verify OTP',
    forgot:   'Reset Password',
    reset:    'Set New Password',
    admin:    'Admin Access'
  };
  document.getElementById('auth-modal-title').textContent = titles[tab] || '';
}

// ── Register ─────────────────────────
function registerUser() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!username || !email || !password) return toast('Please fill all fields', 'error');
  if (password.length < 6)              return toast('Password must be at least 6 characters', 'error');

  const users = DB.get('users') || [];
  if (users.find(u => u.email === email)) return toast('Email already registered', 'error');

  const otp = generateOTP();
  otpStore  = { otp, email, username, password, action: 'register' };
  document.getElementById('otp-email-display').textContent = email;

  // Send real OTP email
  sendOTPEmail(email, username, otp);

  logNotification('OTP', email, 'BiteBaithak – Email Verification', `Your OTP is: ${otp}\nExpires in 10 minutes.`);
  toast('OTP sent to your email! 📧', 'info');
  switchAuthTab('otp');
  clearOTPInputs('otp-inputs');
}

// ── Login ────────────────────────────
function loginUser() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return toast('Please fill all fields', 'error');

  const users = DB.get('users') || [];
  const user  = users.find(u => u.email === email && u.password === hashPassword(password));
  if (!user) return toast('Invalid credentials', 'error');

  const otp = generateOTP();
  otpStore  = { otp, email, action: 'login', user };
  document.getElementById('otp-email-display').textContent = email;

  // Send real OTP email
  sendOTPEmail(email, user.username, otp);

  logNotification('OTP', email, 'BiteBaithak – Login OTP', `Your login OTP is: ${otp}`);
  toast('Login OTP sent to your email! 📧', 'info');
  switchAuthTab('otp');
  clearOTPInputs('otp-inputs');
}

// ── OTP Verify ───────────────────────
function verifyOTP() {
  const entered = Array.from(document.querySelectorAll('#otp-inputs .otp-input'))
                       .map(i => i.value).join('');
  if (entered.length < 6)        return toast('Enter complete 6-digit OTP', 'error');
  if (entered !== otpStore.otp)  return toast('Invalid OTP', 'error');

  if (otpStore.action === 'login') {
    setCurrentUser(otpStore.user);
    toast('Logged in! Welcome back 👋', 'success');
    closeModal('auth-modal');

  } else if (otpStore.action === 'register') {
    const user = {
      id:        generateId(),
      username:  otpStore.username,
      email:     otpStore.email,
      password:  hashPassword(otpStore.password),
      verified:  true,
      createdAt: new Date().toLocaleString(),
    };
    DB.push('users', user);
    sendWelcomeEmail(user);
    logNotification('Welcome', otpStore.email, 'Welcome to BiteBaithak!', `Hi ${otpStore.username}, welcome!`);
    toast('Account created! Welcome 🎉', 'success');
    setCurrentUser(user);
    closeModal('auth-modal');
  }
}

function resendOTP() {
  const otp    = generateOTP();
  otpStore.otp = otp;

  // Send real OTP email again
  sendOTPEmail(otpStore.email, otpStore.username || otpStore.user?.username || otpStore.email, otp);

  logNotification('OTP', otpStore.email, 'BiteBaithak – Resend OTP', `Your new OTP is: ${otp}`);
  toast('New OTP sent to your email! 📧', 'info');
}

// ── Forgot / Reset ───────────────────
function sendForgotOTP() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return toast('Enter your email', 'error');

  const users = DB.get('users') || [];
  if (!users.find(u => u.email === email)) return toast('No account with that email', 'error');

  const otp = generateOTP();
  otpStore  = { otp, email, action: 'reset' };

  // Send real OTP email
  sendOTPEmail(email, email, otp);

  logNotification('OTP', email, 'BiteBaithak – Password Reset', `Reset OTP: ${otp}`);
  toast('Reset OTP sent to your email! 📧', 'info');
  switchAuthTab('reset');
  clearOTPInputs('reset-otp-inputs');
}

function resetPassword() {
  const entered = Array.from(document.querySelectorAll('#reset-otp-inputs .otp-input'))
                       .map(i => i.value).join('');
  const newPass = document.getElementById('new-password').value;

  if (entered.length < 6)       return toast('Enter complete OTP', 'error');
  if (entered !== otpStore.otp) return toast('Invalid OTP', 'error');
  if (newPass.length < 6)       return toast('Password too short', 'error');

  const users = DB.get('users') || [];
  const idx   = users.findIndex(u => u.email === otpStore.email);
  if (idx < 0) return toast('User not found', 'error');

  users[idx].password = hashPassword(newPass);
  DB.set('users', users);
  toast('Password reset successfully!', 'success');
  switchAuthTab('login');
}

// ── Admin Login ──────────────────────
function loginAdmin() {
  const u     = document.getElementById('admin-user').value;
  const p     = document.getElementById('admin-pass').value;
  const admin = DB.get('admin');

  if (u === admin.username && btoa(p) === admin.password) {
    currentUser = { isAdmin: true, username: 'Admin' };
    updateNavUI();
    closeModal('auth-modal');
    showPage('admin');
    toast('Welcome, Admin!', 'success');
  } else {
    toast('Invalid admin credentials', 'error');
  }
}

// ── Helpers ──────────────────────────
function setCurrentUser(user) {
  currentUser = user;
  updateNavUI();
}

function otpMove(el, idx) {
  if (el.value.length === 1) {
    const inputs = document.querySelectorAll('#otp-inputs .otp-input');
    if (idx < 5) inputs[idx + 1].focus();
  }
}

function otpMoveReset(el, idx) {
  if (el.value.length === 1) {
    const inputs = document.querySelectorAll('#reset-otp-inputs .otp-input');
    if (idx < 5) inputs[idx + 1].focus();
  }
}

function clearOTPInputs(containerId) {
  document.querySelectorAll(`#${containerId} .otp-input`).forEach(i => i.value = '');
  const first = document.querySelector(`#${containerId} .otp-input`);
  if (first) setTimeout(() => first.focus(), 100);
}
