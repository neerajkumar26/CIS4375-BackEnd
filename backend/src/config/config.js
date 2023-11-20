const Sequalize = require('sequelize')
require("dotenv").config();   

module.exports = {
PORT: process.env.PORT || 3000,
database: new Sequalize(process.env.DB_NAME || 'coogtech',
process.env.DB_USER || 'Replace with Username',
process.env.DB_PASS || 'Replace with Password',
    {
    host: process.env.HOST || 'Replace with host connection string',
    dialect: process.env.DIALECT || 'mysql',
  
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },

    logging: false
  })
}
