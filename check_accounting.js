const initSqlJs = require('sql.js');
const fs = require('fs');
const fileBuf = fs.readFileSync(process.env.APPDATA + '/triwyn-pos/triwyn_pos.sqlite');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fileBuf);
  console.log("=== Accounts ===");
  const accounts = db.exec("SELECT code, name, type, current_balance FROM accounts");
  console.log(JSON.stringify(accounts, null, 2));

  console.log("\n=== Journal Entries affecting 1010 ===");
  const lines = db.exec(`
    SELECT j.entry_number, j.entry_date, j.reference_type, j.description, l.account_id, a.code, a.name, l.debit, l.credit
    FROM journal_entry_lines l
    JOIN journal_entries j ON l.journal_entry_id = j.id
    JOIN accounts a ON l.account_id = a.id
    WHERE a.code = '1010'
    ORDER BY j.entry_date DESC
    LIMIT 20
  `);
  console.log(JSON.stringify(lines, null, 2));
});
