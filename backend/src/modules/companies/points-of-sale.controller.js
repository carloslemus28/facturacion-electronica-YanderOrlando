const pointsOfSaleService = require('./points-of-sale.service');

const getAllPointsOfSale = async (req, res, next) => {
  try {
    const pointsOfSale = await pointsOfSaleService.getAllPointsOfSale(req.query);

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      pointsOfSale
    });
  } catch (error) {
    next(error);
  }
};

const createPointOfSale = async (req, res, next) => {
  try {
    const pointOfSale = await pointsOfSaleService.createPointOfSale(req.body);

    res.status(201).json({
      ok: true,
      message: 'Punto de venta registrado correctamente',
      pointOfSale
    });
  } catch (error) {
    next(error);
  }
};

const updatePointOfSale = async (req, res, next) => {
  try {
    const { id } = req.params;

    const pointOfSale = await pointsOfSaleService.updatePointOfSale(id, req.body);

    res.status(200).json({
      ok: true,
      message: 'Punto de venta actualizado correctamente',
      pointOfSale
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPointsOfSale,
  createPointOfSale,
  updatePointOfSale
};