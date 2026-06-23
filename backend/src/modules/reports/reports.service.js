const ExcelJS = require('exceljs');
const { Op } = require('sequelize');

const Invoice = require('../invoices/invoice.model');
const Customer = require('../customers/customer.model');
const PointOfSale = require('../companies/point-of-sale.model');
const User = require('../users/user.model');

const REPORT_HEADERS = [
  'Fecha',
  'Número control',
  'Cod. Generación',
  'Sello recepción',
  'NIT',
  'NRC',
  'Receptor',
  'NoSuj',
  'Exenta',
  'Subtotal',
  'IVA',
  'Ret.1%',
  'FOVIAL',
  'COTRANS',
  'Total a pagar',
  'Estado',
  'Est. pago',
  'Observaciones'
];

const DOCUMENT_REPORT_NAMES = {
  '01': 'FAC',
  '03': 'CCF',
  '05': 'NC',
  '11': 'FEx'
};

const formatDateForExcel = (dateValue) => {
  if (!dateValue) return '';

  const date = new Date(dateValue);

  const pad = (value) => String(value).padStart(2, '0');

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

const removeHyphensForExcel = (value) => {
  if (!value) return '';

  return String(value).replace(/-/g, '');
};

const normalizePaymentStatus = (invoice) => {
  if (invoice.status === 'ANULADO') return 'Anulado';

  return 'No pagado';
};

const normalizeDocumentStatus = (status) => {
  const statuses = {
    BORRADOR: 'Borrador',
    GENERADO: 'Generado',
    FIRMADO: 'Firmado',
    TRANSMITIDO: 'Transmitido',
    ACEPTADO: 'Enviado',
    RECHAZADO: 'Rechazado',
    ANULADO: 'Anulado'
  };

  return statuses[status] || status;
};

const getCustomerNitOrDocument = (customer) => {
  if (!customer) return '';

  return customer.documentNumber || '';
};

const getCustomerNrc = (customer) => {
  if (!customer) return '';

  return customer.nrc || '';
};

const buildReportFileName = ({ documentTypeCode, startDate, endDate }) => {
  const reportName = DOCUMENT_REPORT_NAMES[documentTypeCode] || 'DTE';

  return `Lista_${reportName}_${startDate || 'inicio'}_al_${endDate || 'fin'}.xlsx`;
};

const getInvoicesForReport = async ({ documentTypeCode, startDate, endDate, status }) => {
  const where = {};

  if (documentTypeCode) {
    where.documentTypeCode = documentTypeCode;
  }

  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.issuedAt = {};
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    where.issuedAt[Op.gte] = start;
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    where.issuedAt[Op.lte] = end;
  }

  const invoices = await Invoice.findAll({
    where,
    include: [
      {
        model: Customer,
        as: 'customer'
      },
      {
        model: PointOfSale,
        as: 'pointOfSale'
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ],
    order: [['issuedAt', 'ASC']]
  });

  return invoices;
};

const addHeaderStyle = (worksheet) => {
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' }
    };

    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };

    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  headerRow.height = 22;
};

const applyWorksheetStyle = (worksheet) => {
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1
    }
  ];

  worksheet.autoFilter = {
    from: 'A1',
    to: 'R1'
  };

  const widths = [
    22, // Fecha
    36, // Número control
    36, // Cod. Generación
    42, // Sello recepción
    18, // NIT
    14, // NRC
    48, // Receptor
    12, // NoSuj
    12, // Exenta
    14, // Subtotal
    14, // IVA
    14, // Ret.1%
    12, // FOVIAL
    12, // COTRANS
    16, // Total a pagar
    14, // Estado
    14, // Est. pago
    60  // Observaciones
  ];

  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  worksheet.getColumn(8).numFmt = '#,##0.00';
  worksheet.getColumn(9).numFmt = '#,##0.00';
  worksheet.getColumn(2).numFmt = '@';
  worksheet.getColumn(3).numFmt = '@';
  worksheet.getColumn(10).numFmt = '#,##0.00';
  worksheet.getColumn(11).numFmt = '#,##0.00';
  worksheet.getColumn(12).numFmt = '#,##0.00';
  worksheet.getColumn(13).numFmt = '#,##0.00';
  worksheet.getColumn(14).numFmt = '#,##0.00';
  worksheet.getColumn(15).numFmt = '#,##0.00';

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: 'top',
        wrapText: true
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        left: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        right: { style: 'thin', color: { argb: 'FFD9E2F3' } }
      };
    });
  });
};

const buildExcelReport = async ({ documentTypeCode, startDate, endDate, status }) => {
  const invoices = await getInvoicesForReport({
    documentTypeCode,
    startDate,
    endDate,
    status
  });

  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'Sistema de Facturación Electrónica SV';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('DTE Clientes');

  worksheet.addRow(REPORT_HEADERS);

  for (const invoice of invoices) {
    const customer = invoice.customer;

    worksheet.addRow([
  formatDateForExcel(invoice.issuedAt),
  removeHyphensForExcel(invoice.controlNumber),
  removeHyphensForExcel(invoice.generationCode),
  invoice.receptionSeal || '',

      getCustomerNitOrDocument(customer),
      getCustomerNrc(customer),
      customer?.name || '',

      Number(invoice.noSuj || 0),
      Number(invoice.exenta || 0),
      Number(invoice.gravada || invoice.subtotal || 0),
      Number(invoice.iva || 0),
      Number(invoice.retention1 || 0),
      Number(invoice.fovial || 0),
      Number(invoice.cotrans || 0),
      Number(invoice.total || 0),

      normalizeDocumentStatus(invoice.status),
      normalizePaymentStatus(invoice),
      invoice.notes || ''
    ]);
  }

  addHeaderStyle(worksheet);
  applyWorksheetStyle(worksheet);

  return workbook;
};

const listInvoicesForReportPreview = async ({ documentTypeCode, startDate, endDate, status }) => {
  const invoices = await getInvoicesForReport({
    documentTypeCode,
    startDate,
    endDate,
    status
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
    issuedAt: invoice.issuedAt,
    documentTypeCode: invoice.documentTypeCode,
    documentTypeName: invoice.documentTypeName,
    controlNumber: invoice.controlNumber,
    generationCode: invoice.generationCode,
    receptionSeal: invoice.receptionSeal || '',
    customerName: invoice.customer?.name || '',
    customerDocument: invoice.customer?.documentNumber || '',
    customerNrc: invoice.customer?.nrc || '',
    noSuj: Number(invoice.noSuj || 0),
    exenta: Number(invoice.exenta || 0),
    gravada: Number(invoice.gravada || invoice.subtotal || 0),
    subtotal: Number(invoice.subtotal || 0),
    iva: Number(invoice.iva || 0),
    retention1: Number(invoice.retention1 || 0),
    fovial: Number(invoice.fovial || 0),
    cotrans: Number(invoice.cotrans || 0),
    total: Number(invoice.total || 0),
    status: invoice.status,
    paymentStatus: normalizePaymentStatus(invoice),
    notes: invoice.notes || ''
  }));
};

module.exports = {
  buildExcelReport,
  buildReportFileName,
  listInvoicesForReportPreview
};