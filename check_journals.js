const initSqlJs = require('sql.js');
const fs = require('fs');
const fileBuf = fs.readFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fileBuf);
  const lines = db.exec(`
    SELECT j.entry_number, j.entry_date, j.reference_type, j.description, a.account_code, a.account_name, l.debit, l.credit
    FROM journal_entry_lines l
    JOIN journal_entries j ON l.journal_entry_id = j.id
    JOIN accounts a ON l.account_id = a.id
    WHERE a.account_code = '1010'
    ORDER BY j.entry_date DESC
  `);
  console.log("Journal lines for 1010:");
  console.log(JSON.stringify(lines, null, 2));
});
