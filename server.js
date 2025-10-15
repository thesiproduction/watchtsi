// ======== server.js ========
// ✅ Express backend with /api/add-user for Discord bot integration
// ✅ Works with the sipay bot you have

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8081;
const HOSTNAME = process.env.HOSTNAME || '127.0.0.1';

// ✅ Ensure db folder exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

// ✅ Database setup
const db = new sqlite3.Database(path.join(dbDir, 'database.sqlite'));
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY, name TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY, title TEXT, filename TEXT, folder_id INTEGER)");

  // 🔄 Default admin user (if not exists)
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const adminPass = '>]763XFPTr<s';
      db.run(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        ['admin', adminPass, 'admin'],
        (e) => {
          if (e) console.error("❌ Error creating default admin:", e.message);
          else console.log("✅ Default admin created: admin / " + adminPass);
        }
      );
    }
  });
});

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.set('view engine', 'ejs');

// ✅ Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "picture-in-picture=(), fullscreen=()");
  next();
});

// =============== FRONTEND ROUTES ===============

// Login page
app.get('/', (req, res) => res.render('index', { error: '' }));

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (user) {
      req.session.user = user;
      if (user.role === 'admin') return res.redirect('/admin');
      return res.redirect('/videos');
    } else {
      return res.render('index', { error: 'Invalid username or password' });
    }
  });
});

// Admin panel
app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  db.all("SELECT * FROM users", (err, users) => {
    db.all("SELECT * FROM folders", (err, folders) => {
      db.all("SELECT * FROM videos", (err, videos) => {
        res.render('admin', { users, folders, videos });
      });
    });
  });
});

// ✅ Add user manually (admin)
app.post('/admin/add-user', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  const { username, password, role } = req.body;
  db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, password, role || 'user'], (err) => {
    if (err) {
      console.error("❌ Error adding user:", err.message);
      return res.send("Error adding user: " + err.message);
    }
    res.redirect('/admin');
  });
});

// ✅ Secure API for Discord Bot
app.post('/api/add-user', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_SECRET_KEY)
    return res.status(403).json({ error: 'Unauthorized' });

  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing username or password' });

  db.run(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    [username, password, 'user'],
    (err) => {
      if (err) {
        console.error('❌ DB insert failed:', err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log(`✅ Bot created new user: ${username}`);
      res.json({ success: true, username });
    }
  );
});

// ✅ Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ✅ Start server
app.listen(PORT, HOSTNAME, () => {
  console.log(`✅ WatchTSI server running at http://${HOSTNAME}:${PORT}`);
});

