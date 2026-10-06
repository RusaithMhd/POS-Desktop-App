const initSqlJs = require('sql.js');
const fs = require('fs');
const fileBuf = fs.readFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fileBuf);
  const now = new Date().toISOString();
  db.run("UPDATE customer_registrations SET email_verified_at = ?", [now]);
  fs.writeFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite', Buffer.from(db.export()));
  console.log("Email verified for ALL organizations!");
});
