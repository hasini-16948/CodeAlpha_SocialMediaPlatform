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

// Create all tables
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
  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER,
    following_id INTEGER,
    PRIMARY KEY (follower_id, following_id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// REGISTER
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.prepare(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
    ).run(username, email, hashed);
    res.json({ message: 'Registered successfully!' });
  } catch (err) {
    res.status(400).json({ error: 'Username or email already exists' });
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).get(email);
    if (!user) return res.status(400).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Wrong password' });
    const token = jwt.sign({ userId: user.id }, SECRET);
    res.json({ token, username: user.username, userId: user.id });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET USER PROFILE
app.get('/profile/:id', (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, bio FROM users WHERE id = ?'
  ).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});
// CREATE A POST
app.post('/posts', (req, res) => {
  const { content, userId } = req.body;
  try {
    db.prepare(
      'INSERT INTO posts (user_id, content) VALUES (?, ?)'
    ).run(userId, content);
    res.json({ message: 'Post created successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Could not create post' });
  }
});

// GET ALL POSTS
app.get('/posts', (req, res) => {
  const posts = db.prepare(`
    SELECT posts.id, posts.content, posts.created_at,
           users.username, users.id as user_id
    FROM posts
    JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `).all();
  res.json(posts);
});

// GET ONE USER'S POSTS
app.get('/posts/user/:userId', (req, res) => {
  const posts = db.prepare(`
    SELECT posts.id, posts.content, posts.created_at,
           users.username
    FROM posts
    JOIN users ON posts.user_id = users.id
    WHERE posts.user_id = ?
    ORDER BY posts.created_at DESC
  `).all(req.params.userId);
  res.json(posts);
});

// LIKE A POST
app.post('/posts/:id/like', (req, res) => {
  const { userId } = req.body;
  const postId = req.params.id;
  try {
    db.prepare(
      'INSERT INTO likes (user_id, post_id) VALUES (?, ?)'
    ).run(userId, postId);
    res.json({ message: 'Post liked!' });
  } catch (err) {
    res.status(400).json({ error: 'Already liked' });
  }
});

// UNLIKE A POST
app.delete('/posts/:id/like', (req, res) => {
  const { userId } = req.body;
  const postId = req.params.id;
  db.prepare(
    'DELETE FROM likes WHERE user_id = ? AND post_id = ?'
  ).run(userId, postId);
  res.json({ message: 'Post unliked!' });
});

// GET LIKE COUNT
app.get('/posts/:id/likes', (req, res) => {
  const count = db.prepare(
    'SELECT COUNT(*) as likes FROM likes WHERE post_id = ?'
  ).get(req.params.id);
  res.json(count);
});

// ADD COMMENT
app.post('/posts/:id/comment', (req, res) => {
  const { userId, content } = req.body;
  const postId = req.params.id;
  try {
    db.prepare(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)'
    ).run(postId, userId, content);
    res.json({ message: 'Comment added!' });
  } catch (err) {
    res.status(500).json({ error: 'Could not add comment' });
  }
});

// GET COMMENTS
app.get('/posts/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT comments.content, comments.created_at,
           users.username
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE comments.post_id = ?
    ORDER BY comments.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// FOLLOW USER
app.post('/follow', (req, res) => {
  const { followerId, followingId } = req.body;
  try {
    db.prepare(
      'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)'
    ).run(followerId, followingId);
    res.json({ message: 'Followed!' });
  } catch (err) {
    res.status(400).json({ error: 'Already following' });
  }
});

// UNFOLLOW USER
app.delete('/follow', (req, res) => {
  const { followerId, followingId } = req.body;
  db.prepare(
    'DELETE FROM follows WHERE follower_id = ? AND following_id = ?'
  ).run(followerId, followingId);
  res.json({ message: 'Unfollowed!' });
});
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});