/*
  Seed oficial para empresa emisora Yander Orlando Figueroa Magaña.

  Guardar como:
  backend/scripts/02-seed-yander-oficial.js

  Ejecutar desde CMD:
  docker exec -it fe_backend node scripts/02-seed-yander-oficial.js

  Este seed crea:
  - Empresa emisora en PRODUCTION.
  - Casa matriz M001.
  - Punto de venta P001.
  - Usuario yander.facturacion / facturacion123.
  - Cliente CARLOS HUMBERTO LEMUS CANO con 3 actividades económicas.
  - Contador de Factura Consumidor Final 01 en 90.
  - 75 Créditos Fiscales 03 con fechas del mes actual, no futuras.
  - 90 Facturas de Exportación 11 con el mismo cliente.

  No crea Facturas de Consumidor Final.
  No crea Notas de Crédito.
  No simula sellos ni aceptación de Hacienda.
*/

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../src/config/database');
const loadModels = require('../src/config/models');

const Company = require('../src/modules/companies/company.model');
const Establishment = require('../src/modules/companies/establishment.model');
const PointOfSale = require('../src/modules/companies/point-of-sale.model');
const Customer = require('../src/modules/customers/customer.model');
const Product = require('../src/modules/products/product.model');
const User = require('../src/modules/users/user.model');
const Role = require('../src/modules/users/role.model');
const Invoice = require('../src/modules/invoices/invoice.model');
const ControlNumber = require('../src/modules/dte/control-number.model');
const invoicesService = require('../src/modules/invoices/invoices.service');

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/El_Salvador';

const CURRENT_YEAR = Number(
  new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric'
  }).format(new Date())
);

const EMPRESA = {
  nit: '01062008911010',
  nrc: '3562972',
  legalName: 'YANDER ORLANDO FIGUEROA MAGAÑA',
  commercialName: 'MÁS INVERSIÓN FÁCIL ACCESO',
  economicActivityCode: '66190',
  economicActivityName: 'Actividades auxiliares de la intermediación financiera ncp',
  economicActivityCode2: null,
  economicActivityName2: null,
  economicActivityCode3: null,
  economicActivityName3: null,
  establishmentType: 'CASA_MATRIZ',
  establishmentCode: 'M001',
  pointOfSaleCode: 'P001',
  environment: 'PRODUCTION',
  email: 'dte.orlandofigueroa91@gmail.com',
  phone: '76833837',
  departmentCode: '03',
  departmentName: 'Sonsonate',
  districtName: 'San Antonio del Monte',
  municipalityCode: '0301',
  municipalityName: 'Sonsonate Centro',
  addressComplement: 'Block 14 Colonia Lomas de San Antonio #26',
  allowedDocumentTypes: ['01', '03', '05', '11'],
  usesFuelTaxes: false,
  isActive: true
};

const ESTABLECIMIENTO = {
  establishmentType: 'CASA_MATRIZ',
  establishmentCode: 'M001',
  name: 'CASA MATRIZ',
  departmentCode: '03',
  departmentName: 'Sonsonate',
  districtName: 'San Antonio del Monte',
  municipalityCode: '0301',
  municipalityName: 'Sonsonate Centro',
  addressComplement: 'Block 14 Colonia Lomas de San Antonio #26',
  isActive: true
};

const PUNTO_VENTA = {
  code: 'P001',
  name: 'YANDER FIGUEROA',
  description: null,
  isActive: true
};

const USUARIO = {
  username: 'yander.facturacion',
  firstName: 'Yander Orlando',
  lastName: 'Figueroa Magaña',
  email: 'dte.orlandofigueroa91@gmail.com',
  password: 'facturacion123'
};

const CLIENTE = {
  customerType: 'CONTRIBUYENTE',
  documentType: 'NIT',
  documentNumber: '01082602751023',
  nrc: '1629370',
  name: 'CARLOS HUMBERTO LEMUS CANO',
  commercialName: 'CARLOS HUMBERTO LEMUS CANO',

  economicActivityCode: '46211',
  economicActivityName: 'Venta de productos para uso agropecuario',

  secondaryEconomicActivityCode: '96092',
  secondaryEconomicActivityName: 'Servicios n.c.p.',

  tertiaryEconomicActivityCode: '49232',
  tertiaryEconomicActivityName: 'Transporte nacional de carga',

  email: 'carloshlemuscano@gmail.com',
  phone: null,
  phoneCountryCode: null,
  phoneDialCode: null,
  phoneNationalNumber: null,

  departmentCode: '03',
  departmentName: 'Sonsonate',
  districtName: 'Sonsonate',
  municipalityCode: '0301',
  municipalityName: 'Sonsonate Centro',
  addressComplement: 'Residencial El Progreso 2, Senda las Gaviotas Casa #9',

  countryCode: null,
  isActive: true
};

const SERVICIOS = [
  {
    code: 'SERV-FIN-001',
    name: 'Servicio de asesoría financiera',
    price: 45.00
  },
  {
    code: 'SERV-FIN-002',
    name: 'Servicio de gestión financiera',
    price: 55.00
  },
  {
    code: 'SERV-FIN-003',
    name: 'Servicio de intermediación financiera',
    price: 65.00
  }
];

const getSvNowParts = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
};

const buildSvDate = ({ year, month, day, hour = 9, minute = 0, second = 0 }) => {
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute, second));
};

const fechaDelMesActualNoFutura = (index) => {
  const now = getSvNowParts();
  const maxDay = now.day > 1 ? now.day - 1 : 1;
  const day = 1 + (index % maxDay);

  let hour = 8 + (Math.floor(index / maxDay) % 9);
  const minute = (index * 7) % 60;

  if (day === now.day) {
    hour = Math.max(0, Math.min(hour, now.hour - 1));
  }

  return buildSvDate({
    year: now.year,
    month: now.month,
    day,
    hour,
    minute,
    second: 0
  });
};

const normalizarNit = (value) => String(value || '').replace(/\D/g, '');

const crearEmpresaEstablecimientoPuntoVenta = async (transaction) => {
  const existingCompany = await Company.findOne({
    where: { nit: EMPRESA.nit },
    transaction
  });

  if (existingCompany) {
    const invoiceCount = await Invoice.count({
      where: { companyId: existingCompany.id },
      transaction
    });

    if (invoiceCount > 0) {
      throw new Error(
        `La empresa ${EMPRESA.nit} ya tiene ${invoiceCount} DTE. `
        + 'Ejecuta primero el script 01-reset-oficial-keep-admin.js.'
      );
    }
  }

  const [company] = await Company.findOrCreate({
    where: { nit: EMPRESA.nit },
    defaults: EMPRESA,
    transaction
  });

  await company.update(EMPRESA, { transaction });

  const [establishment] = await Establishment.findOrCreate({
    where: {
      companyId: company.id,
      establishmentCode: ESTABLECIMIENTO.establishmentCode
    },
    defaults: {
      companyId: company.id,
      ...ESTABLECIMIENTO
    },
    transaction
  });

  await establishment.update(
    {
      companyId: company.id,
      ...ESTABLECIMIENTO
    },
    { transaction }
  );

  const [pointOfSale] = await PointOfSale.findOrCreate({
    where: {
      establishmentId: establishment.id,
      code: PUNTO_VENTA.code
    },
    defaults: {
      companyId: company.id,
      establishmentId: establishment.id,
      ...PUNTO_VENTA
    },
    transaction
  });

  await pointOfSale.update(
    {
      companyId: company.id,
      establishmentId: establishment.id,
      ...PUNTO_VENTA
    },
    { transaction }
  );

  return { company, establishment, pointOfSale };
};

const crearUsuarioFacturador = async ({ pointOfSale, transaction }) => {
  const passwordHash = await bcrypt.hash(USUARIO.password, 12);

  const [user] = await User.findOrCreate({
    where: { username: USUARIO.username },
    defaults: {
      username: USUARIO.username,
      firstName: USUARIO.firstName,
      lastName: USUARIO.lastName,
      email: USUARIO.email,
      passwordHash,
      pointOfSaleId: pointOfSale.id,
      isActive: true
    },
    transaction
  });

  await user.update(
    {
      firstName: USUARIO.firstName,
      lastName: USUARIO.lastName,
      email: USUARIO.email,
      passwordHash,
      pointOfSaleId: pointOfSale.id,
      isActive: true
    },
    { transaction }
  );

  const [role] = await Role.findOrCreate({
    where: { code: 'FACTURADOR' },
    defaults: {
      code: 'FACTURADOR',
      name: 'Facturador/Caja',
      description: 'Usuario operativo de facturación y caja',
      isActive: true
    },
    transaction
  });

  await user.setRoles([role], { transaction });

  return user;
};

const asignarEmpresaAlAdmin = async ({ pointOfSale, transaction }) => {
  const adminRows = await sequelize.query(
    `
      SELECT u.id
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE r.code = 'ADMIN'
      ORDER BY u.id ASC
      LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      transaction
    }
  );

  if (!adminRows.length) return;

  await User.update(
    { pointOfSaleId: pointOfSale.id },
    {
      where: { id: adminRows[0].id },
      transaction
    }
  );
};

const crearCliente = async ({ establishment, transaction }) => {
  const [customer] = await Customer.findOrCreate({
    where: {
      establishmentId: establishment.id,
      documentType: CLIENTE.documentType,
      documentNumber: normalizarNit(CLIENTE.documentNumber)
    },
    defaults: {
      establishmentId: establishment.id,
      ...CLIENTE,
      documentNumber: normalizarNit(CLIENTE.documentNumber)
    },
    transaction
  });

  await customer.update(
    {
      establishmentId: establishment.id,
      ...CLIENTE,
      documentNumber: normalizarNit(CLIENTE.documentNumber)
    },
    { transaction }
  );

  return customer;
};

const crearServicios = async ({ establishment, transaction }) => {
  const created = [];

  for (const servicio of SERVICIOS) {
    const [product] = await Product.findOrCreate({
      where: {
        establishmentId: establishment.id,
        code: servicio.code
      },
      defaults: {
        establishmentId: establishment.id,
        code: servicio.code,
        itemType: 'SERVICIO',
        name: servicio.name,
        description: servicio.name,
        unitOfMeasure: '59',
        unitOfMeasureName: 'Unidad',
        purchasePrice: null,
        salePrice: servicio.price,
        unitPrice: servicio.price,
        appliesIva: true,
        stock: null,
        isActive: true
      },
      transaction
    });

    await product.update(
      {
        itemType: 'SERVICIO',
        name: servicio.name,
        description: servicio.name,
        unitOfMeasure: '59',
        unitOfMeasureName: 'Unidad',
        purchasePrice: null,
        salePrice: servicio.price,
        unitPrice: servicio.price,
        appliesIva: true,
        stock: null,
        isActive: true
      },
      { transaction }
    );

    created.push(product);
  }

  return created;
};

const prepararContadorConsumidorFinalEn90 = async ({ company, pointOfSale, transaction }) => {
  const establishment = await Establishment.findByPk(pointOfSale.establishmentId, { transaction });

  if (!establishment) {
    throw new Error('No se encontró el establecimiento del punto de venta para preparar contadores.');
  }

  await ControlNumber.findOrCreate({
    where: {
      companyId: company.id,
      year: CURRENT_YEAR,
      documentTypeCode: '01',
      establishmentCode: establishment.establishmentCode,
      pointOfSaleCode: pointOfSale.code
    },
    defaults: {
      companyId: company.id,
      year: CURRENT_YEAR,
      documentTypeCode: '01',
      establishmentCode: establishment.establishmentCode,
      pointOfSaleCode: pointOfSale.code,
      currentSequence: 90
    },
    transaction
  });

  await ControlNumber.update(
    { currentSequence: 90 },
    {
      where: {
        companyId: company.id,
        year: CURRENT_YEAR,
        documentTypeCode: '01',
        establishmentCode: establishment.establishmentCode,
        pointOfSaleCode: pointOfSale.code
      },
      transaction
    }
  );

  await ControlNumber.findOrCreate({
    where: {
      companyId: company.id,
      year: CURRENT_YEAR,
      documentTypeCode: '05',
      establishmentCode: establishment.establishmentCode,
      pointOfSaleCode: pointOfSale.code
    },
    defaults: {
      companyId: company.id,
      year: CURRENT_YEAR,
      documentTypeCode: '05',
      establishmentCode: establishment.establishmentCode,
      pointOfSaleCode: pointOfSale.code,
      currentSequence: 0
    },
    transaction
  });
};

const construirItem = ({ index }) => {
  const servicio = SERVICIOS[index % SERVICIOS.length];
  const variacion = (index % 10) * 3.25;
  const unitPrice = Number((servicio.price + variacion).toFixed(2));

  return {
    itemType: 'SERVICIO',
    code: servicio.code,
    description: `${servicio.name} ${String(index + 1).padStart(3, '0')}`,
    unitOfMeasure: '59',
    unitOfMeasureName: 'Unidad',
    saleType: 'GRAVADA',
    quantity: 1,
    unitPrice,
    retention1: 0,
    fovial: 0,
    cotrans: 0
  };
};

const crearDteGenerado = async ({ documentTypeCode, customer, user, index }) => {
  const descripcion = documentTypeCode === '03'
    ? 'Crédito fiscal oficial generado por seed'
    : 'Factura de exportación oficial generada por seed';

  return invoicesService.createGeneratedInvoice({
    user: {
      id: user.id,
      sub: user.id,
      username: user.username,
      roles: ['FACTURADOR']
    },
    data: {
      documentTypeCode,
      customerId: customer.id,
      issuedAt: fechaDelMesActualNoFutura(index).toISOString(),
      operationCondition: 'CONTADO',
      paymentMethod: 'EFECTIVO',
      saleDescription: descripcion,
      notes: 'Documento generado para transmisión oficial. Sin sello simulado.',
      items: [
        construirItem({ index })
      ]
    }
  });
};

const validarBaseLimpiaParaEmpresa = async (companyId) => {
  const count = await Invoice.count({ where: { companyId } });

  if (count > 0) {
    throw new Error(
      `La empresa ya tiene ${count} DTE. No se ejecuta el seed para evitar duplicados oficiales.`
    );
  }
};

const main = async () => {
  console.log('🚀 Iniciando seed oficial Yander Figueroa...');
  console.log('⚠️  Ambiente de empresa: PRODUCTION');
  console.log('⚠️  No se crearán Facturas Consumidor Final ni Notas de Crédito.');

  loadModels();
  await sequelize.authenticate();
  await sequelize.sync();

  const base = await sequelize.transaction(async (transaction) => {
    const { company, establishment, pointOfSale } = await crearEmpresaEstablecimientoPuntoVenta(transaction);

    const user = await crearUsuarioFacturador({ pointOfSale, transaction });

    await asignarEmpresaAlAdmin({ pointOfSale, transaction });

    const customer = await crearCliente({ establishment, transaction });

    await crearServicios({ establishment, transaction });

    await prepararContadorConsumidorFinalEn90({ company, pointOfSale, transaction });

    return { company, establishment, pointOfSale, user, customer };
  });

  await validarBaseLimpiaParaEmpresa(base.company.id);

  console.log(`✅ Empresa: ${base.company.legalName}`);
  console.log(`✅ Cliente receptor: ${base.customer.name}`);
  console.log(`✅ Usuario facturador/caja: ${base.user.username}`);
  console.log('✅ Contador 01 preparado en 90. La próxima Factura Consumidor Final será 91.');

  const creditosFiscales = [];
  const facturasExportacion = [];

  console.log('\n🏢 Creando 75 Créditos Fiscales del mes actual...');

  for (let i = 0; i < 75; i += 1) {
    const invoice = await crearDteGenerado({
      documentTypeCode: '03',
      customer: base.customer,
      user: base.user,
      index: i
    });

    creditosFiscales.push(invoice);

    if ((i + 1) % 15 === 0) {
      console.log(`   CCF creados: ${i + 1}/75`);
    }
  }

  console.log('\n🌎 Creando 90 Facturas de Exportación con el mismo cliente...');

  for (let i = 0; i < 90; i += 1) {
    const invoice = await crearDteGenerado({
      documentTypeCode: '11',
      customer: base.customer,
      user: base.user,
      index: i + 75
    });

    facturasExportacion.push(invoice);

    if ((i + 1) % 15 === 0) {
      console.log(`   FEX creadas: ${i + 1}/90`);
    }
  }

  const resumen = await Invoice.findAll({
    where: { companyId: base.company.id },
    attributes: [
      'documentTypeCode',
      'documentTypeName',
      [sequelize.fn('COUNT', sequelize.col('Invoice.id')), 'total']
    ],
    group: ['documentTypeCode', 'documentTypeName'],
    order: [['documentTypeCode', 'ASC']],
    raw: true
  });

  const controles = await ControlNumber.findAll({
    where: { companyId: base.company.id },
    order: [['documentTypeCode', 'ASC']],
    raw: true
  });

  console.log('\n✅ Seed oficial completado correctamente.');
  console.table(resumen);

  console.log('Correlativos actuales:');
  console.table(
    controles.map((control) => ({
      tipo: control.document_type_code || control.documentTypeCode,
      establecimiento: control.establishment_code || control.establishmentCode,
      puntoVenta: control.point_of_sale_code || control.pointOfSaleCode,
      secuencia: control.current_sequence || control.currentSequence
    }))
  );

  console.log('\nAcceso del usuario facturador/caja:');
  console.log(`Usuario: ${USUARIO.username}`);
  console.log(`Contraseña: ${USUARIO.password}`);

  console.log('\nResultado esperado:');
  console.log('01 Factura Consumidor Final: NO se crean; contador queda en 90.');
  console.log('03 Crédito Fiscal: 75 documentos GENERADOS.');
  console.log('11 Factura de Exportación: 90 documentos GENERADOS.');
  console.log('05 Nota de Crédito: NO se crean todavía.');

  await sequelize.close();
};

main().catch(async (error) => {
  console.error('\n❌ Error ejecutando el seed oficial:');
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