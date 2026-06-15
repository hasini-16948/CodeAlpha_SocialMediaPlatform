# Vibe — Social Media Platform

A full-stack Social Media Platform built using Node.js, Express.js, SQLite, HTML, CSS and JavaScript. The application lets users share posts, interact with others through likes and comments, and explore profiles in a clean and minimal feed.

---

## Features

**Authentication**
- Register and login with email and password
- Passwords are encrypted before storing
- Session is maintained securely using tokens

**Posts**
- Create and share posts with everyone
- Delete your own posts
- Feed shows all posts sorted by newest first

**Likes and Comments**
- Like and unlike any post instantly
- Comment on posts
- Like count updates in real time

**Profiles**
- Click any username to view their profile
- See all posts by that user in one place

---

## Tech Stack

- HTML5, CSS3, JavaScript
- Node.js, Express.js
- SQLite, bcrypt, JWT

---

## Project Structure

```
CodeAlpha_SocialMediaPlatform/
├── backend/
│   ├── server.js
│   ├── social.db
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── README.md
```

---

## Setup

Clone the repo:

```bash
git clone https://github.com/hasini-16948/CodeAlpha_SocialMediaPlatform.git
```

Install dependencies:

```bash
cd CodeAlpha_SocialMediaPlatform/backend
npm install
```

Start the server:

```bash
node server.js
```

Open `frontend/index.html` in your browser. The backend runs on `http://localhost:3000`.

*Built as part of the CodeAlpha Internship Program.*