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
    }
  });
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.set('view engine', 'ejs');

// ✅ Your routes here … (no change)

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


