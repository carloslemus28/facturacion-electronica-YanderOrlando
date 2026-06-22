const { sequelize } = require('../../config/database');

const Company = require('../companies/company.model');
const Establishment = require('../companies/establishment.model');
const PointOfSale = require('../companies/point-of-sale.model');
const ControlNumber = require('./control-number.model');

const DOCUMENT_TYPES = {
  FE: '01',
  CCF: '03',
  NR: '04',
  NC: '05',
  ND: '06',
  CRE: '07',
  CLE: '08',
  DCL: '09',
  FEX: '11',
  FSE: '14',
  CD: '15'
};

const getCurrentYear = () => {
  const timeZone = process.env.APP_TIMEZONE || 'America/El_Salvador';

  const year = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric'
  }).format(new Date());

  return Number(year);
};

const padSequence = (sequence) => {
  return String(sequence).padStart(15, '0');
};

const buildControlNumber = ({
  documentTypeCode,
  establishmentCode,
  pointOfSaleCode,
  sequence
}) => {
  return `DTE-${documentTypeCode}-${establishmentCode}${pointOfSaleCode}-${padSequence(sequence)}`;
};

const getDocumentTypes = () => {
  return DOCUMENT_TYPES;
};

const getPointOfSaleWithEstablishment = async ({ pointOfSaleId, transaction = null }) => {
  const pointOfSale = await PointOfSale.findByPk(pointOfSaleId, {
    include: [
      {
        model: Establishment,
        as: 'establishment'
      }
    ],
    transaction
  });

  if (!pointOfSale) {
    const error = new Error('Punto de venta no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (!pointOfSale.establishment) {
    const error = new Error('El punto de venta no tiene establecimiento o sucursal asignada');
    error.statusCode = 400;
    throw error;
  }

  return pointOfSale;
};

const previewNextControlNumber = async ({
  companyId,
  pointOfSaleId,
  documentTypeCode,
  year = getCurrentYear()
}) => {
  const company = await Company.findByPk(companyId);

  if (!company) {
    const error = new Error('Empresa emisora no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const pointOfSale = await getPointOfSaleWithEstablishment({
    pointOfSaleId
  });

  if (Number(pointOfSale.companyId) !== Number(companyId)) {
    const error = new Error('El punto de venta no pertenece a la empresa emisora indicada');
    error.statusCode = 403;
    throw error;
  }

  const establishmentCode = pointOfSale.establishment.establishmentCode;
  const pointOfSaleCode = pointOfSale.code;

  const control = await ControlNumber.findOne({
    where: {
      companyId,
      year,
      documentTypeCode,
      establishmentCode,
      pointOfSaleCode
    }
  });

  const nextSequence = control ? Number(control.currentSequence) + 1 : 1;

  return {
    year,
    documentTypeCode,
    establishmentCode,
    pointOfSaleCode,
    nextSequence,
    controlNumber: buildControlNumber({
      documentTypeCode,
      establishmentCode,
      pointOfSaleCode,
      sequence: nextSequence
    })
  };
};

const generateNextControlNumber = async ({
  companyId,
  pointOfSaleId,
  documentTypeCode,
  year = getCurrentYear()
}) => {
  return sequelize.transaction(async (transaction) => {
    const company = await Company.findByPk(companyId, { transaction });

    if (!company) {
      const error = new Error('Empresa emisora no encontrada');
      error.statusCode = 404;
      throw error;
    }

    const pointOfSale = await getPointOfSaleWithEstablishment({
      pointOfSaleId,
      transaction
    });

    if (Number(pointOfSale.companyId) !== Number(companyId)) {
      const error = new Error('El punto de venta no pertenece a la empresa emisora indicada');
      error.statusCode = 403;
      throw error;
    }

    const establishmentCode = pointOfSale.establishment.establishmentCode;
    const pointOfSaleCode = pointOfSale.code;

    const [control] = await ControlNumber.findOrCreate({
      where: {
        companyId,
        year,
        documentTypeCode,
        establishmentCode,
        pointOfSaleCode
      },
      defaults: {
        companyId,
        year,
        documentTypeCode,
        establishmentCode,
        pointOfSaleCode,
        currentSequence: 0
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    const nextSequence = Number(control.currentSequence) + 1;

    await control.update({
      currentSequence: nextSequence
    }, { transaction });

    return {
      year,
      documentTypeCode,
      establishmentCode,
      pointOfSaleCode,
      sequence: nextSequence,
      controlNumber: buildControlNumber({
        documentTypeCode,
        establishmentCode,
        pointOfSaleCode,
        sequence: nextSequence
      })
    };
  });
};

const listControlNumbers = async () => {
  const controls = await ControlNumber.findAll({
    include: [
      {
        model: Company,
        as: 'company',
        attributes: ['id', 'nit', 'legalName', 'commercialName']
      }
    ],
    order: [
      ['year', 'DESC'],
      ['documentTypeCode', 'ASC'],
      ['establishmentCode', 'ASC'],
      ['pointOfSaleCode', 'ASC']
    ]
  });

  return controls;
};

module.exports = {
  DOCUMENT_TYPES,
  getDocumentTypes,
  previewNextControlNumber,
  generateNextControlNumber,
  listControlNumbers
};