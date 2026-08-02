const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const TABLE_DOES_NOT_EXIST_CODES = new Set([
  'ER_NO_SUCH_TABLE',
  'ER_BAD_TABLE_ERROR'
]);

const tableExists = async (tableName) => {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1`,
    { replacements: [tableName] }
  );

  return Array.isArray(rows) && rows.length > 0;
};

const ensureColumn = async ({ tableName, columnName, definition }) => {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists(tableName))) {
    return false;
  }

  try {
    const table = await queryInterface.describeTable(tableName);

    if (table[columnName]) {
      return false;
    }

    await queryInterface.addColumn(tableName, columnName, definition);
    return true;
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code || error?.code;

    if (TABLE_DOES_NOT_EXIST_CODES.has(code)) {
      return false;
    }

    throw error;
  }
};

const ensureRuntimeSchema = async () => {
  const changes = [];

  if (await ensureColumn({
    tableName: 'customers',
    columnName: 'secondary_email',
    definition: {
      type: DataTypes.STRING(160),
      allowNull: true
    }
  })) {
    changes.push('customers.secondary_email');
  }

  if (await ensureColumn({
    tableName: 'companies',
    columnName: 'use_logo_in_pdf',
    definition: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  })) {
    changes.push('companies.use_logo_in_pdf');
  }

  if (changes.length > 0) {
    console.log(`✅ Esquema actualizado: ${changes.join(', ')}`);
  }
};

module.exports = ensureRuntimeSchema;
