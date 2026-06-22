const companiesService = require('./companies.service');

const getActiveCompany = async (req, res, next) => {
  try {
    const company = await companiesService.getActiveCompany();

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      company
    });
  } catch (error) {
    next(error);
  }
};

const createCompany = async (req, res, next) => {
  try {
    const company = await companiesService.createCompany(req.body);

    res.status(201).json({
      ok: true,
      message: 'Empresa emisora registrada correctamente',
      company
    });
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;

    const company = await companiesService.updateCompany(id, req.body);

    res.status(200).json({
      ok: true,
      message: 'Empresa emisora actualizada correctamente',
      company
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveCompany,
  createCompany,
  updateCompany
};