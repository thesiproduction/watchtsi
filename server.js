const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();

// 🚀 VPS HOSTING UPDATE: Set a fixed internal port and listen on localhost
const PORT = 8081; // Use this internal port, Nginx will proxy external port 80 to it
const HOSTNAME = '127.0.0.1'; // Listen only on the local interface (security!)

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
    db.run("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY, title TEXT, filename TEXT, folder_id INTEGER)"); // Combined CREATE TABLE

    // 🔄 Migration: check and create default admin
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            const adminPass = '>]763XFPTr<s'; // Default admin password
            db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', adminPass, 'admin'], (e) => {
                if (e) console.error("❌ Error creating default admin:", e.message);
                else console.log("✅ Default admin created.");
            });
        }
    });
});

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.set('view engine', 'ejs');

// 🔒 Security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "picture-in-picture=(), fullscreen=()");
    next();
});

// ⛔ Routes are unchanged (omitted for brevity)

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

// ✅ Add user
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

// ✅ Delete user
app.post('/admin/delete-user', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
    const { id } = req.body;

    // prevent deleting self
    if (parseInt(id) === req.session.user.id) {
        return res.send("<script>alert('You cannot delete your own account'); window.location='/admin';</script>");
    }

    db.run("DELETE FROM users WHERE id = ?", [id], (err) => {
        if (err) {
            console.error("❌ Error deleting user:", err.message);
            return res.send("Error deleting user: " + err.message);
        }
        res.redirect('/admin');
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

// ✅ Add video
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

// ✅ View videos inside a folder
app.get('/videos/folder/:folderId', (req, res) => {
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
app.listen(PORT, HOSTNAME, () => {
    console.log(`✅ Server running internally at http://${HOSTNAME}:${PORT}`);
});
