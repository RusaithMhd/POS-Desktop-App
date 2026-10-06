const initSqlJs = require('sql.js');
const fs = require('fs');
const fileBuf = fs.readFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fileBuf);
  console.log("journal_entries:", JSON.stringify(db.exec("PRAGMA table_info(journal_entries)")));
  console.log("journal_lines:", JSON.stringify(db.exec("PRAGMA table_info(journal_lines)")));
});
