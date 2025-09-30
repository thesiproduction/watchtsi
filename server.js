
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();

// ✅ Use Render/Replit port
const PORT = process.env.PORT || 3000;

// ✅ Ensure db folder exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// ✅ Database setup
const db = new sqlite3.Database(path.join(dbDir, 'database.sqlite'));
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY, name TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY, title TEXT, filename TEXT, folder_id INTEGER)");

  // Create default admin if not exists
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const adminPass = '>]763XFPTr<s'; // Default admin password
      db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', adminPass, 'admin']);
    }
  });
});

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.set('view engine', 'ejs');

// 🔒 Security headers to reduce recording/downloading
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY"); // block embedding in iframes
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "picture-in-picture=(), fullscreen=()");
  next();
});

// ✅ Routes

// Login page
app.get('/', (req, res) => {
  res.render('index', { error: '' });
});

// Handle login
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
    db.all("SELECT * FROM folders", (err, folders) => {
      db.all("SELECT * FROM videos", (err, videos) => {
        res.render('admin', { users, folders, videos });
      });
    });
  });
});

// Add folder
app.post('/admin/add-folder', (req, res) => {
  const { name } = req.body;
  db.run("INSERT INTO folders (name) VALUES (?)", [name], () => {
    res.redirect('/admin');
  });
});

// Delete folder (also deletes videos in it)
app.post('/admin/delete-folder', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM folders WHERE id = ?", [id], () => {
    db.run("DELETE FROM videos WHERE folder_id = ?", [id], () => {
      res.redirect('/admin');
    });
  });
});

// ✅ Add video (fixed to handle empty folder_id and log errors)
app.post('/admin/add-video', (req, res) => {
  const { title, filename, folder_id } = req.body;
  const folderId = folder_id && folder_id.trim() !== "" ? parseInt(folder_id, 10) : null;

  db.run(
    "INSERT INTO videos (title, filename, folder_id) VALUES (?, ?, ?)",
    [title, filename, folderId],
    function (err) {
      if (err) {
        console.error("❌ Error inserting video:", err.message);
        return res.send("Error adding video: " + err.message);
      }
      console.log(`✅ Video added with ID ${this.lastID}, folder: ${folderId}`);
      res.redirect('/admin');
    }
  );
});

// Delete video
app.post('/admin/delete-video', (req, res) => {
  const { id } = req.body;
  db.run("DELETE FROM videos WHERE id = ?", [id], () => {
    res.redirect('/admin');
  });
});

// Videos page (list folders)
app.get('/videos', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  db.all("SELECT * FROM folders", (err, folders) => {
    res.render('folders', { folders, username: req.session.user.username });
  });
});

// ✅ View videos inside a folder (handles empty folders too)
app.get('/videos/:folderId', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const folderId = req.params.folderId;
  db.get("SELECT * FROM folders WHERE id = ?", [folderId], (err, folder) => {
    if (!folder) return res.redirect('/videos');
    db.all("SELECT * FROM videos WHERE folder_id = ?", [folderId], (err, videos) => {
      if (!videos || videos.length === 0) {
        res.render('videos', { folder, videos: [], empty: true, username: req.session.user.username });
      } else {
        res.render('videos', { folder, videos, empty: false, username: req.session.user.username });
      }
    });
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

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});




















