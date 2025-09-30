const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();

// Port (Render/Replit friendly)
const PORT = process.env.PORT || 3000;

// Ensure db folder exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

// Database setup
const db = new sqlite3.Database(path.join(dbDir, 'database.sqlite'));
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY, title TEXT, filename TEXT)");

  // Create default admin if not exists
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const adminPass = '>]763XFPTr<s'; 
      db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', adminPass, 'admin']);
      console.log("✅ Default admin created (username: admin, password: >]763XFPTr<s)");
    }
  });
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.set('view engine', 'ejs');

// ===== ROUTES =====

// Homepage
app.get("/", (req, res) => {
  db.all("SELECT * FROM videos", (err, videos) => {
    if (err) return res.send("DB error");
    res.render("index", { user: req.session.user, videos });
  });
});

// Login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Login form submission
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username=? AND password=?", [username, password], (err, user) => {
    if (user) {
      req.session.user = user;
      return res.redirect(user.role === "admin" ? "/admin" : "/");
    }
    res.send("❌ Invalid login");
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Admin panel
app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Forbidden ❌");
  }
  db.all("SELECT * FROM videos", (err, videos) => {
    res.render("admin", { user: req.session.user, videos });
  });
});

// Upload new video (admin only)
app.post("/admin/add", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Forbidden ❌");
  }
  const { title, filename } = req.body; // for simplicity (manual upload to /videos folder)
  db.run("INSERT INTO videos (title, filename) VALUES (?, ?)", [title, filename], () => {
    res.redirect("/admin");
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});



