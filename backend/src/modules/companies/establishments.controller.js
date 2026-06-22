const establishmentsService = require('./establishments.service');

const listEstablishments = async (req, res, next) => {
  try {
    const establishments = await establishmentsService.listEstablishments(req.query);

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      establishments
    });
  } catch (error) {
    next(error);
  }
};

const getEstablishmentById = async (req, res, next) => {
  try {
    const establishment = await establishmentsService.getEstablishmentById(req.params.id);

    res.status(200).json({
      ok: true,
      establishment
    });
  } catch (error) {
    next(error);
  }
};

const createEstablishment = async (req, res, next) => {
  try {
    const establishment = await establishmentsService.createEstablishment(req.body);

    res.status(201).json({
      ok: true,
      message: 'Establecimiento registrado correctamente',
      establishment
    });
  } catch (error) {
    next(error);
  }
};

const updateEstablishment = async (req, res, next) => {
  try {
    const establishment = await establishmentsService.updateEstablishment(
      req.params.id,
      req.body
    );

    res.status(200).json({
      ok: true,
      message: 'Establecimiento actualizado correctamente',
      establishment
    });
  } catch (error) {
    next(error);
  }
};

const getNextEstablishmentCode = async (req, res, next) => {
  try {
    const code = await establishmentsService.getNextEstablishmentCode({
      companyId: req.query.companyId,
      establishmentType: req.query.establishmentType
    });

    res.status(200).json({
      ok: true,
      code
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listEstablishments,
  getEstablishmentById,
  createEstablishment,
  updateEstablishment,
  getNextEstablishmentCode
};