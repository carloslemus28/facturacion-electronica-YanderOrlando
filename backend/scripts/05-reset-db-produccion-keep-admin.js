/*
  Reset total de base de datos para iniciar ambiente productivo.

  Conserva:
  - Usuario admin
  - Roles
  - Permisos
  - Relación del admin con su rol

  Elimina:
  - Empresas
  - Establecimientos
  - Puntos de venta
  - Usuarios no admin
  - Clientes
  - Productos/servicios
  - DTE
  - Ítems de DTE
  - Eventos DTE
  - Correos
  - Refresh tokens
  - Contadores DTE

  Ejecutar:
  docker exec -it -e CONFIRM_RESET_PRODUCTION_EMPTY=true fe_backend node scripts/05-reset-db-produccion-keep-admin.js
*/

require('dotenv').config();

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../src/config/database');

const CONFIRM_RESET = String(
  process.env.CONFIRM_RESET_PRODUCTION_EMPTY || 'false'
).toLowerCase() === 'true';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL_TO_KEEP || 'admin@facturacion.local';

const tableExists = async (tableName) => {
  const rows = await sequelize.query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
      LIMIT 1
    `,
    {
      replacements: { tableName },
      type: QueryTypes.SELECT
    }
  );

  return rows.length > 0;
};

const safeDelete = async (tableName) => {
  if (!(await tableExists(tableName))) {
    console.log(`⚠️ Tabla no existe, se omite: ${tableName}`);
    return;
  }

  await sequelize.query(`DELETE FROM \`${tableName}\`;`);
  console.log(`🧹 Tabla vaciada: ${tableName}`);
};

const safeResetAutoIncrement = async (tableName, nextValue = 1) => {
  if (!(await tableExists(tableName))) {
    return;
  }

  await sequelize.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = ${Number(nextValue)};`);
  console.log(`🔢 AUTO_INCREMENT reiniciado en ${tableName} => ${nextValue}`);
};

const main = async () => {
  if (!CONFIRM_RESET) {
    throw new Error(
      'Protección activa. Ejecuta con: -e CONFIRM_RESET_PRODUCTION_EMPTY=true'
    );
  }

  console.log('🚨 Iniciando limpieza total de base de datos...');
  console.log(`👤 Usuario admin a conservar: ${ADMIN_EMAIL}`);

  await sequelize.authenticate();

  const adminRows = await sequelize.query(
    `
      SELECT id, email, username
      FROM users
      WHERE email = :email
      LIMIT 1
    `,
    {
      replacements: { email: ADMIN_EMAIL },
      type: QueryTypes.SELECT
    }
  );

  if (adminRows.length === 0) {
    throw new Error(`No se encontró el usuario admin con email: ${ADMIN_EMAIL}`);
  }

  const admin = adminRows[0];

  console.log(`✅ Admin encontrado: ID ${admin.id} | ${admin.email} | ${admin.username}`);

  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;', { transaction });

    // Limpiar sesiones/tokens
    await safeDelete('refresh_tokens');

    // Limpiar logs/correos
    await safeDelete('email_logs');

    // Limpiar eventos DTE
    await safeDelete('dte_event_items');
    await safeDelete('dte_events');

    // Limpiar DTE
    await safeDelete('invoice_items');
    await safeDelete('invoices');

    // Limpiar catálogos operativos
    await safeDelete('products');
    await safeDelete('customers');

    // Limpiar contadores DTE
    await safeDelete('control_numbers');

    // Eliminar relaciones de usuarios no admin
    if (await tableExists('user_roles')) {
      await sequelize.query(
        'DELETE FROM user_roles WHERE user_id <> :adminId;',
        {
          replacements: { adminId: admin.id },
          transaction
        }
      );
      console.log('🧹 Roles de usuarios no admin eliminados');
    }

    // Si el admin tuviera punto de venta asignado, se limpia para no dejar relación rota.
    await sequelize.query(
      'UPDATE users SET point_of_sale_id = NULL WHERE id = :adminId;',
      {
        replacements: { adminId: admin.id },
        transaction
      }
    );

    // Eliminar usuarios no admin
    await sequelize.query(
      'DELETE FROM users WHERE id <> :adminId;',
      {
        replacements: { adminId: admin.id },
        transaction
      }
    );
    console.log('🧹 Usuarios no admin eliminados');

    // Limpiar estructura empresarial
    await safeDelete('points_of_sale');
    await safeDelete('establishments');
    await safeDelete('companies');

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;', { transaction });
  });

  // Reiniciar AUTO_INCREMENT de tablas operativas
  const tablesToReset = [
    'refresh_tokens',
    'email_logs',
    'dte_event_items',
    'dte_events',
    'invoice_items',
    'invoices',
    'products',
    'customers',
    'control_numbers',
    'points_of_sale',
    'establishments',
    'companies'
  ];

  for (const tableName of tablesToReset) {
    await safeResetAutoIncrement(tableName, 1);
  }

  // Ajustar users al siguiente ID después del admin
  const nextUserId = Number(admin.id) + 1;
  await safeResetAutoIncrement('users', nextUserId);

  const summary = await sequelize.query(
    `
      SELECT 'companies' AS tabla, COUNT(*) AS total FROM companies
      UNION ALL
      SELECT 'establishments', COUNT(*) FROM establishments
      UNION ALL
      SELECT 'points_of_sale', COUNT(*) FROM points_of_sale
      UNION ALL
      SELECT 'users', COUNT(*) FROM users
      UNION ALL
      SELECT 'customers', COUNT(*) FROM customers
      UNION ALL
      SELECT 'products', COUNT(*) FROM products
      UNION ALL
      SELECT 'control_numbers', COUNT(*) FROM control_numbers
      UNION ALL
      SELECT 'invoices', COUNT(*) FROM invoices
      UNION ALL
      SELECT 'invoice_items', COUNT(*) FROM invoice_items
      UNION ALL
      SELECT 'dte_events', COUNT(*) FROM dte_events
      UNION ALL
      SELECT 'dte_event_items', COUNT(*) FROM dte_event_items
      UNION ALL
      SELECT 'email_logs', COUNT(*) FROM email_logs
      UNION ALL
      SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  console.log('\n✅ Limpieza completada.');
  console.table(summary);

  console.log('\nResultado esperado:');
  console.log('- users = 1');
  console.log('- Todo lo demás = 0');
  console.log('- Roles y permisos se conservan');
  console.log('- Contadores DTE reiniciados');

  await sequelize.close();
};

main().catch(async (error) => {
  console.error('\n❌ Error durante la limpieza de base de datos:');
  console.error(error.message);

  if (error.stack) {
    console.error(error.stack);
  }

  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    await sequelize.close();
  } catch {
    // Sin acción adicional.
  }

  process.exit(1);
});