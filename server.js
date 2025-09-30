
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

// ✅ Use Replit’s assigned port (no hardcoding!)
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./db/database.sqlite');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY, title TEXT, filename TEXT)");

  // Create default admin if not exists
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const adminPass = '>]763XFPTr<s'; // <-- Change manually if needed
      db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', adminPass, 'admin']);
    }
  });
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.set('view engine', 'ejs');

// Routes

// Login page
app.get('/', (req, res) => {
  res.render('index', { error: '' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (user) {
      req.session.user = user;
      if (user.role === 'admin') return res.redirect('/admin');
      res.redirect('/videos');
    } else {
      res.render('index', { error: 'Invalid username or password' });
    }
  });
});

// Admin panel
app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  db.all("SELECT * FROM users", (err, users) => {
    db.all("SELECT * FROM videos", (err, videos) => {
      res.render('admin', { users, videos });
    });
  });
});

// Add user
app.post('/admin/add-user', (req, res) => {
  const { username, password } = req.body;
  db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'user')", [username, password], () => {
    res.redirect('/admin');
  });
});

// Delete user
app.post('/admin/delete-user', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM users WHERE id = ?", [id], () => {
    res.redirect('/admin');
  });
});

// Add video
app.post('/admin/add-video', (req, res) => {
  const { title, filename } = req.body;
  db.run("INSERT INTO videos (title, filename) VALUES (?, ?)", [title, filename], () => {
    res.redirect('/admin');
  });
});

// Delete video
app.post('/admin/delete-video', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM videos WHERE id = ?", [id], () => {
    res.redirect('/admin');
  });
});

// Videos page for users
app.get('/videos', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  db.all("SELECT * FROM videos", (err, videos) => {
    res.render('videos', { videos, username: req.session.user.username });
  });
});

// User change password page
app.get('/change-password', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('change-password');
});

// Handle user password change
app.post('/change-password', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const { oldPassword, newPassword } = req.body;
  const userId = req.session.user.id;

  db.get("SELECT * FROM users WHERE id = ? AND password = ?", [userId, oldPassword], (err, row) => {
    if (!row) {
      return res.send('<script>alert("Current password incorrect"); window.location="/change-password";</script>');
    }

    db.run("UPDATE users SET password = ? WHERE id = ?", [newPassword, userId], (err) => {
      if (!err) {
        res.send('<script>alert("Password changed successfully"); window.location="/videos";</script>');
      } else {
        res.send('Error updating password');
      }
    });
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ✅ Start server (Replit-friendly)
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

