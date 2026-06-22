/*
  Limpieza total de base de datos dejando únicamente el usuario ADMIN.

  Guardar como:
  backend/scripts/01-reset-oficial-keep-admin.js

  Ejecutar desde CMD:
  docker exec -it -e CONFIRM_RESET_OFICIAL=true fe_backend node scripts/01-reset-oficial-keep-admin.js

  Este script elimina todos los datos operativos y reinicia los AUTO_INCREMENT.
  Conserva roles, permisos, role_permissions y únicamente un usuario admin.
*/

require('dotenv').config();

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../src/config/database');
const loadModels = require('../src/config/models');

const CONFIRM_RESET = String(process.env.CONFIRM_RESET_OFICIAL || 'false').toLowerCase() === 'true';

const REQUIRED_TABLES_TO_TRUNCATE = [
  'email_logs',
  'dte_event_items',
  'dte_events',
  'invoice_items',
  'invoices',
  'control_numbers',
  'products',
  'customers',
  'points_of_sale',
  'establishments',
  'companies'
];

const tableExists = async (tableName) => {
  const rows = await sequelize.query(
    'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :tableName',
    {
      replacements: { tableName },
      type: QueryTypes.SELECT
    }
  );

  return Number(rows[0]?.total || 0) > 0;
};

const getAdminUserId = async () => {
  const rows = await sequelize.query(
    `
      SELECT u.id, u.username, u.email
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE r.code = 'ADMIN'
         OR u.email = 'admin@facturacion.local'
         OR u.username IN ('Admin123', 'admin', 'admin@facturacion.local')
      ORDER BY
        CASE
          WHEN u.email = 'admin@facturacion.local' THEN 1
          WHEN r.code = 'ADMIN' THEN 2
          ELSE 3
        END,
        u.id ASC
      LIMIT 1
    `,
    { type: QueryTypes.SELECT }
  );

  if (!rows.length) {
    throw new Error('No se encontró usuario Admin. No se puede ejecutar la limpieza de forma segura.');
  }

  return rows[0];
};

const main = async () => {
  if (!CONFIRM_RESET) {
    throw new Error(
      'Protección activa. Para ejecutar la limpieza usa: -e CONFIRM_RESET_OFICIAL=true'
    );
  }

  loadModels();
  await sequelize.authenticate();

  const admin = await getAdminUserId();

  console.log('⚠️  Iniciando limpieza total de base de datos...');
  console.log(`👤 Usuario Admin conservado: ID ${admin.id} | ${admin.username || ''} | ${admin.email || ''}`);

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    await sequelize.query('UPDATE users SET point_of_sale_id = NULL');

    if (await tableExists('refresh_tokens')) {
      await sequelize.query('TRUNCATE TABLE refresh_tokens');
    }

    if (await tableExists('user_roles')) {
      await sequelize.query('DELETE FROM user_roles WHERE user_id <> :adminId', {
        replacements: { adminId: admin.id }
      });
    }

    await sequelize.query('DELETE FROM users WHERE id <> :adminId', {
      replacements: { adminId: admin.id }
    });

    for (const tableName of REQUIRED_TABLES_TO_TRUNCATE) {
      if (await tableExists(tableName)) {
        console.log(`🧹 Limpiando tabla: ${tableName}`);
        await sequelize.query(`TRUNCATE TABLE ${tableName}`);
      }
    }

    const maxUserRows = await sequelize.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM users', {
      type: QueryTypes.SELECT
    });

    const nextUserId = Number(maxUserRows[0]?.maxId || 0) + 1;
    await sequelize.query(`ALTER TABLE users AUTO_INCREMENT = ${nextUserId}`);

    console.log('✅ Limpieza completada correctamente.');
    console.log('✅ Se conservaron roles, permisos y el usuario Admin.');
    console.log('✅ Los contadores DTE fueron eliminados; el seed oficial creará el tipo 01 en 90.');
  } finally {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    await sequelize.close();
  }
};

main().catch(async (error) => {
  console.error('\n❌ Error ejecutando limpieza:');
  console.error(error.message);

  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    await sequelize.close();
  } catch (closeError) {
    // Sin acción adicional.
  }

  process.exit(1);
});