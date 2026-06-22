require('dotenv').config();

const app = require('./app');
const { sequelize, testConnection } = require('./config/database');
const loadModels = require('./config/models');
const seedSecurityData = require('./config/seed');

const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000;

const startServer = async () => {
  await testConnection();

  loadModels();

  await sequelize.sync();

  await seedSecurityData();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend ejecutándose en el puerto ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('❌ El backend no pudo iniciarse:', error);
  process.exit(1);
});