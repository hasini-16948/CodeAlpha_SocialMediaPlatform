const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('social.db');
const SECRET = 'socialmedia_secret_key_2024';

app.use(cors());
app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    bio TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER,
    post_id INTEGER,
    PRIMARY KEY (user_id, post_id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// REGISTER
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hashed);
    res.json({ message: 'Registered successfully!' });
  } catch {
    res.status(400).json({ error: 'Username or email already exists' });
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Wrong password' });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, userId: user.id });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// PROFILE
app.get('/profile/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, email, bio FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// CREATE POST (auth required)
app.post('/posts', auth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)').run(req.user.userId, content.trim());
    res.json({ message: 'Post created!' });
  } catch {
    res.status(500).json({ error: 'Could not create post' });
  }
});

// GET ALL POSTS
app.get('/posts', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT posts.id, posts.content, posts.created_at, users.username, users.id as user_id
      FROM posts JOIN users ON posts.user_id = users.id
      ORDER BY posts.created_at DESC
    `).all();
    res.json(posts);
  } catch { res.json([]); }
});

// GET USER POSTS
app.get('/posts/user/:userId', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT posts.id, posts.content, posts.created_at, users.username
      FROM posts JOIN users ON posts.user_id = users.id
      WHERE posts.user_id = ? ORDER BY posts.created_at DESC
    `).all(req.params.userId);
    res.json(posts);
  } catch { res.json([]); }
});

// DELETE POST (auth + ownership check)
app.delete('/posts/:id', auth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your post' });
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted!' });
});

// LIKE (auth required)
app.post('/posts/:id/like', auth, (req, res) => {
  try {
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.userId, req.params.id);
    res.json({ message: 'Liked!' });
  } catch {
    res.status(400).json({ error: 'Already liked' });
  }
});

app.delete('/posts/:id/like', auth, (req, res) => {
  db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.userId, req.params.id);
  res.json({ message: 'Unliked!' });
});

app.get('/posts/:id/likes', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as likes FROM likes WHERE post_id = ?').get(req.params.id);
  res.json(row);
});

app.get('/users/:userId/liked-posts', (req, res) => {
  try {
    const rows = db.prepare('SELECT post_id FROM likes WHERE user_id = ?').all(req.params.userId);
    res.json(rows.map(r => r.post_id));
  } catch { res.json([]); }
});

// COMMENTS (auth required)
app.post('/posts/:id/comment', auth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)').run(req.params.id, req.user.userId, content.trim());
    res.json({ message: 'Comment added!' });
  } catch {
    res.status(500).json({ error: 'Could not add comment' });
  }
});

app.get('/posts/:id/comments', (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT comments.id, comments.content, comments.created_at, users.username
      FROM comments JOIN users ON comments.user_id = users.id
      WHERE comments.post_id = ? ORDER BY comments.created_at ASC
    `).all(req.params.id);
    res.json(comments);
  } catch { res.json([]); }
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));