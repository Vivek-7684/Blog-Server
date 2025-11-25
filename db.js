const mysql = require("mysql2/promise");

const connection = mysql
  .createConnection({
    host: "localhost",
    user: "root",
    password: "Redhat@123",
    database: "sample",
  });

module.exports = connection;
