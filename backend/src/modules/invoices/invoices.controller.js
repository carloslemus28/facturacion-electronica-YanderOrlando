const emailsService = require('../emails/emails.service');
const invoicesService = require('./invoices.service');

const createGeneratedInvoice = async (req, res, next) => {
  try {
    const invoice = await invoicesService.createGeneratedInvoice({
      data: req.body,
      user: req.user
    });

    res.status(201).json({
      ok: true,
      message: 'DTE generado correctamente',
      invoice
    });
  } catch (error) {
    next(error);
  }
};

const updateGeneratedInvoice = async (req, res, next) => {
  try {
    const invoice = await invoicesService.updateGeneratedInvoice({
      id: req.params.id,
      data: req.body,
      user: req.user
    });

    res.status(200).json({
      ok: true,
      message: 'DTE actualizado correctamente',
      invoice
    });
  } catch (error) {
    next(error);
  }
};

const listInvoices = async (req, res, next) => {
  try {
    const invoices = await invoicesService.listInvoices({
      user: req.user
    });

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      invoices
    });
  } catch (error) {
    next(error);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoicesService.getInvoiceById(req.params.id, {
      user: req.user
    });

    res.status(200).json({
      ok: true,
      invoice
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardSummary = async (req, res, next) => {
  try {
    const summary = await invoicesService.getDashboardSummary({
      user: req.user
    });

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      summary
    });
  } catch (error) {
    next(error);
  }
};

const listAvailableDocumentsForCreditNote = async (req, res, next) => {
  try {
    const invoices = await invoicesService.listAvailableDocumentsForCreditNote({
      user: req.user
    });

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      invoices
    });
  } catch (error) {
    next(error);
  }
};

const transmitReal = async (req, res, next) => {
  try {
    const invoice = await invoicesService.transmitInvoiceToHaciendaReal({
      id: req.params.id,
      user: req.user
    });

    let automaticEmail = {
      sent: false,
      skipped: false,
      message: null
    };

    const recipient = String(invoice.customer?.email || '').trim();

    if (!recipient) {
      automaticEmail = {
        sent: false,
        skipped: true,
        message: 'El cliente no tiene correo registrado para el envío automático.'
      };
    } else {
      try {
        const email = await emailsService.sendInvoiceEmail({
          id: invoice.id,
          user: req.user,
          to: recipient
        });

        automaticEmail = {
          sent: true,
          skipped: false,
          recipient: email.recipient
        };
      } catch (emailError) {
        /*
          Hacienda ya aceptó el DTE. Un fallo SMTP no debe convertir
          la transmisión fiscal en error ni revertir el documento.
        */
        console.error(
          `⚠️ DTE ${invoice.id} aceptado por Hacienda, pero no se pudo enviar el correo automático: ${emailError.message}`
        );

        automaticEmail = {
          sent: false,
          skipped: false,
          recipient,
          message: emailError.message
        };
      }
    }

    res.json({
      ok: true,
      message: 'DTE transmitido correctamente a Hacienda',
      invoice,
      automaticEmail
    });
  } catch (error) {
    next(error);
  }
};

const invalidateReal = async (req, res, next) => {
  try {
    const invoice = await invoicesService.invalidateInvoiceReal({
      id: req.params.id,
      user: req.user,
      reason: req.body.reason
    });

    res.json({
      ok: true,
      message: 'DTE anulado correctamente ante Hacienda',
      invoice
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGeneratedInvoice,
  updateGeneratedInvoice,
  listInvoices,
  getInvoiceById,
  getDashboardSummary,
  listAvailableDocumentsForCreditNote,
  transmitReal,
  invalidateReal
};