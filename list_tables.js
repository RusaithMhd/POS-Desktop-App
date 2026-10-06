const initSqlJs = require('sql.js');
const fs = require('fs');
const fileBuf = fs.readFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fileBuf);
  console.log("tables:", JSON.stringify(db.exec("SELECT name FROM sqlite_master WHERE type='table'")));
});
