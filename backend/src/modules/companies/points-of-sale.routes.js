const express = require('express');

const pointsOfSaleController = require('./points-of-sale.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  pointsOfSaleController.getAllPointsOfSale
);

router.post(
  '/',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  pointsOfSaleController.createPointOfSale
);

router.put(
  '/:id',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  pointsOfSaleController.updatePointOfSale
);

module.exports = router;