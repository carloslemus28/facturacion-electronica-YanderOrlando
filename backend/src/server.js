require('dotenv').config();

const app = require('./app');
const { sequelize, testConnection } = require('./config/database');
const loadModels = require('./config/models');
const seedSecurityData = require('./config/seed');
const ensureRuntimeSchema = require('./config/runtime-schema');

const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000;

let httpServer = null;

const shutdown = async (signal) => {
  try {
    console.log(`Recibida señal ${signal}. Cerrando backend ordenadamente...`);

    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }

    await sequelize.close();
    console.log('Conexiones MySQL cerradas correctamente');
    process.exit(0);
  } catch (error) {
    console.error('Error cerrando backend:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  await testConnection();

  loadModels();

  await ensureRuntimeSchema({ phase: 'before-sync' });
  await sequelize.sync();
  await ensureRuntimeSchema({ phase: 'after-sync' });

  await seedSecurityData();

  httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend ejecutándose en el puerto ${PORT}`);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer().catch((error) => {
  console.error('❌ El backend no pudo iniciarse:', error);
  process.exit(1);
});
