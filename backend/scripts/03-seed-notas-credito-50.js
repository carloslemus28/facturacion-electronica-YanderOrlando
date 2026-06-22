/*
  Seed para crear 50 Notas de Crédito sobre los primeros 50 CCF aceptados.

  Guardar como:
  backend/scripts/03-seed-notas-credito-50.js

  Ejecutar:
  docker exec -it -e CONFIRM_CREATE_NC=true fe_backend node scripts/03-seed-notas-credito-50.js

  Este seed:
  - Busca la empresa emisora YANDER ORLANDO FIGUEROA MAGAÑA por NIT.
  - Busca el usuario yander.facturacion.
  - Toma los primeros 50 CCF aceptados por Hacienda.
  - Crea 50 Notas de Crédito tipo 05.
  - Relaciona cada Nota de Crédito con su CCF aceptado.
  - No simula sellos.
  - No transmite a Hacienda.
  - Las deja en estado GENERADO.
*/

require('dotenv').config();

const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../src/config/database');
const loadModels = require('../src/config/models');

const Company = require('../src/modules/companies/company.model');
const User = require('../src/modules/users/user.model');
const Role = require('../src/modules/users/role.model');
const Invoice = require('../src/modules/invoices/invoice.model');
const InvoiceItem = require('../src/modules/invoices/invoice-item.model');
const Customer = require('../src/modules/customers/customer.model');
const invoicesService = require('../src/modules/invoices/invoices.service');

const CONFIRM_CREATE_NC = String(process.env.CONFIRM_CREATE_NC || 'false').toLowerCase() === 'true';

const COMPANY_NIT = '01062008911010';
const USERNAME = 'yander.facturacion';
const TOTAL_NOTAS_CREDITO = 50;

const getSvIssuedAt = (index) => {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  const hour = 11 + (index % 5);
  const minute = (index * 3) % 60;

  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    hour + 6,
    minute,
    0
  ));
};

const buildUserPayload = (user) => {
  const roles = Array.isArray(user.roles)
    ? user.roles.map((role) => role.code)
    : ['FACTURADOR'];

  return {
    id: user.id,
    sub: user.id,
    username: user.username,
    roles
  };
};

const main = async () => {
  if (!CONFIRM_CREATE_NC) {
    throw new Error(
      'Protección activa. Para crear las Notas de Crédito ejecuta con: -e CONFIRM_CREATE_NC=true'
    );
  }

  console.log('🚀 Iniciando seed de 50 Notas de Crédito...');

  loadModels();

  await sequelize.authenticate();

  const company = await Company.findOne({
    where: {
      nit: COMPANY_NIT
    }
  });

  if (!company) {
    throw new Error(`No se encontró la empresa emisora con NIT ${COMPANY_NIT}`);
  }

  const user = await User.findOne({
    where: {
      username: USERNAME
    },
    include: [
      {
        model: Role,
        as: 'roles'
      }
    ]
  });

  if (!user) {
    throw new Error(`No se encontró el usuario ${USERNAME}`);
  }

  if (!user.pointOfSaleId) {
    throw new Error(`El usuario ${USERNAME} no tiene punto de venta asignado`);
  }

  const existingCreditNotes = await Invoice.count({
    where: {
      companyId: company.id,
      documentTypeCode: '05'
    }
  });

  if (existingCreditNotes > 0) {
    throw new Error(
      `Ya existen ${existingCreditNotes} Notas de Crédito para esta empresa. `
      + 'No se ejecuta el seed para evitar duplicados.'
    );
  }

  const ccfRows = await sequelize.query(
  `
    SELECT 
      i.id
    FROM invoices i
    INNER JOIN companies c 
      ON c.id = i.company_id
    WHERE c.nit = :companyNit
      AND i.document_type_code = '03'
      AND i.status = 'ACEPTADO'
      AND i.reception_seal IS NOT NULL
    ORDER BY CAST(SUBSTRING_INDEX(i.control_number, '-', -1) AS UNSIGNED) ASC
    LIMIT :limit
  `,
  {
    replacements: {
      companyNit: COMPANY_NIT,
      limit: TOTAL_NOTAS_CREDITO
    },
    type: QueryTypes.SELECT
  }
);

const ccfIds = ccfRows.map((row) => row.id);

const ccfRecords = await Invoice.findAll({
  where: {
    id: {
      [Op.in]: ccfIds
    }
  },
  include: [
    {
      model: Customer,
      as: 'customer'
    },
    {
      model: InvoiceItem,
      as: 'items'
    }
  ]
});

const ccfMap = new Map(
  ccfRecords.map((invoice) => [Number(invoice.id), invoice])
);

const ccfAceptados = ccfIds
  .map((id) => ccfMap.get(Number(id)))
  .filter(Boolean);

  if (ccfAceptados.length < TOTAL_NOTAS_CREDITO) {
    throw new Error(
      `Solo se encontraron ${ccfAceptados.length} CCF aceptados con sello. `
      + `Se necesitan ${TOTAL_NOTAS_CREDITO}.`
    );
  }

  console.log(`✅ Empresa: ${company.legalName}`);
  console.log(`✅ Usuario emisor: ${user.username}`);
  console.log(`✅ CCF aceptados encontrados: ${ccfAceptados.length}`);

  const createdNotes = [];

  for (let index = 0; index < ccfAceptados.length; index += 1) {
    const ccf = ccfAceptados[index];

    const existingNoteForCcf = await Invoice.findOne({
      where: {
        companyId: company.id,
        documentTypeCode: '05',
        relatedInvoiceId: ccf.id
      }
    });

    if (existingNoteForCcf) {
      throw new Error(
        `El CCF ${ccf.controlNumber} ya tiene una Nota de Crédito relacionada: ${existingNoteForCcf.controlNumber}`
      );
    }

    const sourceItems = Array.isArray(ccf.items) ? ccf.items : [];

    if (sourceItems.length === 0) {
      throw new Error(`El CCF ${ccf.controlNumber} no tiene detalle de ítems`);
    }

    const noteItems = sourceItems.map((item, itemIndex) => ({
      productId: item.productId || null,
      itemType: item.itemType || 'SERVICIO',
      code: item.code || `NC-${String(index + 1).padStart(3, '0')}-${String(itemIndex + 1).padStart(2, '0')}`,
      description: `Nota de crédito aplicada a ${ccf.controlNumber} - ${item.description || 'Ajuste de crédito fiscal'}`,
      unitOfMeasure: item.unitOfMeasure || '59',
      unitOfMeasureName: item.unitOfMeasureName || 'Unidad',
      saleType: item.saleType || 'GRAVADA',
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      retention1: Number(item.retention1 || 0),
      fovial: Number(item.fovial || 0),
      cotrans: Number(item.cotrans || 0)
    }));

    const nc = await invoicesService.createGeneratedInvoice({
      user: buildUserPayload(user),
      data: {
        documentTypeCode: '05',
        relatedInvoiceId: ccf.id,
        customerId: ccf.customerId,
        issuedAt: getSvIssuedAt(index).toISOString(),
        operationCondition: ccf.operationCondition || 'CONTADO',
        paymentMethod: ccf.paymentMethod || 'EFECTIVO',
        notes: `Nota de Crédito generada por seed sobre CCF aceptado ${ccf.controlNumber}. Sin sello simulado.`,
        items: noteItems
      }
    });

    createdNotes.push(nc);

    console.log(
      `✅ NC ${String(index + 1).padStart(2, '0')}/50 creada: ${nc.controlNumber} relacionada con ${ccf.controlNumber}`
    );
  }

  const resumen = await Invoice.findAll({
    where: {
      companyId: company.id,
      documentTypeCode: {
        [Op.in]: ['03', '05']
      }
    },
    attributes: [
      'documentTypeCode',
      'status',
      [sequelize.fn('COUNT', sequelize.col('Invoice.id')), 'total']
    ],
    group: ['documentTypeCode', 'status'],
    order: [
      ['documentTypeCode', 'ASC'],
      ['status', 'ASC']
    ],
    raw: true
  });

  console.log('\n✅ Seed de Notas de Crédito completado.');
  console.table(resumen);

  console.log('\nResultado esperado:');
  console.log('03 Crédito Fiscal: ya aceptados por Hacienda.');
  console.log('05 Nota de Crédito: 50 documentos GENERADOS, listos para transmitir.');

  await sequelize.close();
};

main().catch(async (error) => {
  console.error('\n❌ Error ejecutando seed de Notas de Crédito:');
  console.error(error.message);

  if (error.stack) {
    console.error(error.stack);
  }

  try {
    await sequelize.close();
  } catch (closeError) {
    // Sin acción adicional.
  }

  process.exit(1);
});