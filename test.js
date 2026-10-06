const initSqlJs = require('sql.js');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const fileBuf = fs.readFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fileBuf);
  const result = db.exec("SELECT username, password_hash FROM users WHERE username = 'royalsupermart_admin'");
  console.log(JSON.stringify(result));
  
  if (result.length > 0) {
    const hash = result[0].values[0][1];
    console.log("Matches 12345678:", bcrypt.compareSync('12345678', hash));
  }
});
