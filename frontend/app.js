const API = 'http://localhost:3000';
let token = localStorage.getItem('token');
let currentUserId = localStorage.getItem('userId');
let currentUsername = localStorage.getItem('username');

// Auth header helper
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

// Safely escape text to prevent XSS
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

window.onload = function () {
  if (token && currentUserId) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    loadPosts();
  }
};

// ── AUTH ──────────────────────────────────────────
function showLogin() {
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('auth-message').textContent = '';
}

function showRegister() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('auth-message').textContent = '';
}

function showMessage(msg, color) {
  const el = document.getElementById('auth-message');
  el.textContent = msg;
  el.style.color = color;
}

async function register() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !email || !password) return showMessage('Please fill in all fields', 'red');
  try {
    const res  = await fetch(`${API}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password }) });
    const data = await res.json();
    if (data.message) { showMessage('Account created! Please sign in.', 'green'); showLogin(); }
    else showMessage(data.error || 'Registration failed', 'red');
  } catch { showMessage('Network error', 'red'); }
}

async function login() {
  const email    = document.getElementById('log-email').value.trim();
  const password = document.getElementById('log-password').value;
  if (!email || !password) return showMessage('Please fill in all fields', 'red');
  try {
    const res  = await fetch(`${API}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (data.token) {
      token = data.token; currentUserId = String(data.userId); currentUsername = data.username;
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', String(data.userId));
      localStorage.setItem('username', data.username);
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('app-section').style.display  = 'block';
      loadPosts();
    } else showMessage(data.error || 'Login failed', 'red');
  } catch { showMessage('Network error', 'red'); }
}

function logout() {
  localStorage.clear();
  token = currentUserId = currentUsername = null;
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('app-section').style.display  = 'none';
}

// ── POSTS ─────────────────────────────────────────
async function createPost() {
  const content = document.getElementById('post-content').value.trim();
  if (!content) return;
  try {
    const res = await fetch(`${API}/posts`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ content }) });
    if (res.ok) { document.getElementById('post-content').value = ''; loadPosts(); }
  } catch { console.error('Post failed'); }
}

async function loadPosts() {
  try {
    const [postsRes, likedRes] = await Promise.all([
      fetch(`${API}/posts`),
      fetch(`${API}/users/${currentUserId}/liked-posts`)
    ]);
    const posts = await postsRes.json();
    const likedPostIds = likedRes.ok ? await likedRes.json() : [];

    const box = document.getElementById('posts-container');
    box.innerHTML = '';

    if (!posts || !posts.length) {
      box.innerHTML = '<div class="empty">No posts yet — be the first to share!</div>';
      return;
    }

    posts.forEach(post => {
      const letter = post.username ? post.username.charAt(0).toUpperCase() : 'U';
      const date   = new Date(post.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const isMyPost = String(post.user_id) === String(currentUserId);
      const isLiked  = likedPostIds.includes(post.id);

      const card = document.createElement('div');
      card.className = 'post-card';
      card.id = `post-${post.id}`;
      card.innerHTML = `
        <div class="post-header">
          <div class="avatar" onclick="viewProfile(${post.user_id}, '${esc(post.username)}')">${esc(letter)}</div>
          <div>
            <div class="post-username" onclick="viewProfile(${post.user_id}, '${esc(post.username)}')">${esc(post.username)}</div>
            <div class="post-time">${date}</div>
          </div>
        </div>
        <div class="post-content">${esc(post.content)}</div>
        <div class="post-actions">
          <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" id="like-btn-${post.id}" data-liked="${isLiked}" onclick="likePost(${post.id})">
            <span class="thumb-icon">👍</span> <span class="btn-text">${isLiked ? 'Liked' : 'Like'}</span>
          </button>
          <span class="like-count" id="like-count-${post.id}"></span>
          <button class="action-btn" onclick="toggleComments(${post.id})">💬 Comment</button>
          ${isMyPost ? `<button class="action-btn delete-btn" onclick="deletePost(${post.id})">🗑️ Delete</button>` : ''}
        </div>
        <div class="comments-section" id="comments-${post.id}" style="display:none">
          <div id="comments-list-${post.id}"></div>
          <div class="comment-input">
            <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." onkeydown="if(event.key==='Enter') addComment(${post.id})">
            <button onclick="addComment(${post.id})">Send</button>
          </div>
        </div>`;
      box.appendChild(card);
      loadLikeCount(post.id);
    });
  } catch (err) { console.error(err); }
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    const res = await fetch(`${API}/posts/${postId}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      document.getElementById(`post-${postId}`)?.remove();
      if (document.getElementById('profile-section').style.display === 'block') {
        viewProfile(currentUserId, currentUsername);
      }
    }
  } catch { console.error('Delete failed'); }
}

// ── LIKES ─────────────────────────────────────────
async function loadLikeCount(postId) {
  try {
    const res  = await fetch(`${API}/posts/${postId}/likes`);
    const data = await res.json();
    const el   = document.getElementById(`like-count-${postId}`);
    if (el) el.textContent = data.likes > 0 ? `${data.likes} like${data.likes !== 1 ? 's' : ''}` : '';
  } catch {}
}

async function likePost(postId) {
  const btn = document.getElementById(`like-btn-${postId}`);
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  const isLiked = btn.dataset.liked === 'true';
  const method  = isLiked ? 'DELETE' : 'POST';

  // Optimistic UI
  btn.dataset.liked = String(!isLiked);
  btn.querySelector('.btn-text').textContent = isLiked ? 'Like' : 'Liked';
  btn.classList.toggle('liked', !isLiked);

  try {
    await fetch(`${API}/posts/${postId}/like`, { method, headers: authHeaders() });
  } catch {}

  // Sync real count from server
  await loadLikeCount(postId);
  btn.disabled = false;
}

// ── COMMENTS ──────────────────────────────────────
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  const hidden  = section.style.display === 'none';
  section.style.display = hidden ? 'block' : 'none';
  if (hidden) loadComments(postId);
}

async function loadComments(postId) {
  try {
    const res      = await fetch(`${API}/posts/${postId}/comments`);
    const comments = await res.json();
    const list     = document.getElementById(`comments-list-${postId}`);
    if (!list) return;
    if (!comments.length) {
      list.innerHTML = '<p style="color:#aaa;font-size:13px;padding:4px 0">No comments yet</p>';
      return;
    }
    list.innerHTML = '';
    comments.forEach(c => {
      const div = document.createElement('div');
      div.className = 'comment';
      div.innerHTML = `<strong>${esc(c.username)}</strong> ${esc(c.content)}`;
      list.appendChild(div);
    });
  } catch {}
}

async function addComment(postId) {
  const input   = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;
  try {
    const res = await fetch(`${API}/posts/${postId}/comment`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ content }) });
    if (res.ok) { input.value = ''; loadComments(postId); }
  } catch {}
}

// ── PROFILE ───────────────────────────────────────
async function viewProfile(userId, username) {
  document.getElementById('feed-section').style.display    = 'none';
  document.getElementById('profile-section').style.display = 'block';

  document.getElementById('profile-avatar-big').textContent = username.charAt(0).toUpperCase();
  document.getElementById('profile-username').textContent   = username;
  document.getElementById('profile-label').textContent      =
    String(userId) === String(currentUserId) ? 'Your profile' : '@' + username;

  try {
    const res   = await fetch(`${API}/posts/user/${userId}`);
    const posts = await res.json();
    const box   = document.getElementById('user-posts');

    if (!posts.length) { box.innerHTML = '<div class="empty">No posts yet</div>'; return; }

    box.innerHTML = '';
    posts.forEach(p => {
      const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const isMyPost = String(userId) === String(currentUserId);
      const card = document.createElement('div');
      card.className = 'post-card';
      card.id = `post-${p.id}`;
      card.innerHTML = `
        <div class="post-content">${esc(p.content)}</div>
        <div class="post-actions" style="border-top:none;padding-top:0;">
          <span class="post-time">${date}</span>
          ${isMyPost ? `<button class="action-btn delete-btn" style="margin-left:auto;" onclick="deletePost(${p.id})">🗑️ Delete</button>` : ''}
        </div>`;
      box.appendChild(card);
    });
  } catch {}
}

function showProfile() { viewProfile(currentUserId, currentUsername); }

function showFeed() {
  document.getElementById('feed-section').style.display    = 'block';
  document.getElementById('profile-section').style.display = 'none';
  loadPosts();
}