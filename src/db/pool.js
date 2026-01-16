require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool(process.env.DATABASE_URL, {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
