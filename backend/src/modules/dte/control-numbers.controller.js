const controlNumbersService = require('./control-numbers.service');

const getDocumentTypes = async (req, res) => {
  res.status(200).json({
    ok: true,
    documentTypes: controlNumbersService.getDocumentTypes()
  });
};

const listControlNumbers = async (req, res, next) => {
  try {
    const controlNumbers = await controlNumbersService.listControlNumbers();

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      controlNumbers
    });
  } catch (error) {
    next(error);
  }
};

const previewNextControlNumber = async (req, res, next) => {
  try {
    const preview = await controlNumbersService.previewNextControlNumber(req.body);

    res.status(200).json({
      ok: true,
      preview
    });
  } catch (error) {
    next(error);
  }
};

const generateNextControlNumber = async (req, res, next) => {
  try {
    const result = await controlNumbersService.generateNextControlNumber(req.body);

    res.status(201).json({
      ok: true,
      message: 'Número de control generado correctamente',
      result
    });
  } catch (error) {
    next(error);
  }
};

const generateFromSession = async (req, res, next) => {
  try {
    const { documentTypeCode, year } = req.body;

    if (!req.user.company || !req.user.pointOfSale) {
      return res.status(400).json({
        ok: false,
        message: 'El usuario no tiene empresa o punto de venta asignado'
      });
    }

    const result = await controlNumbersService.generateNextControlNumber({
      companyId: req.user.company.id,
      pointOfSaleId: req.user.pointOfSale.id,
      documentTypeCode,
      year
    });

    res.status(201).json({
      ok: true,
      message: 'Número de control generado correctamente',
      result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDocumentTypes,
  listControlNumbers,
  previewNextControlNumber,
  generateNextControlNumber,
  generateFromSession
};