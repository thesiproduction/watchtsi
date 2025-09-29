const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

const newAdminPass = '>]763XFPTr<s';

db.run("UPDATE users SET password = ? WHERE username = 'admin'", [newAdminPass], function(err) {
  if (err) console.error(err.message);
  else console.log("Admin password updated!");
  db.close();
});
