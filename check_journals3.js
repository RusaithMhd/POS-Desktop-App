const initSqlJs = require('sql.js');
const fs = require('fs');
const fileBuf = fs.readFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fileBuf);
  const entries = db.exec(`
    SELECT j.journal_number, j.transaction_date, j.reference_type, j.description, a.account_code, a.account_name, l.debit, l.credit
    FROM journal_lines l
    JOIN journal_entries j ON l.journal_entry_id = j.id
    JOIN accounts a ON l.account_id = a.id
    ORDER BY j.transaction_date ASC
  `);
  console.log(JSON.stringify(entries, null, 2));
});
