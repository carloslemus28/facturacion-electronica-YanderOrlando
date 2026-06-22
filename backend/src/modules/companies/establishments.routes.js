const express = require('express');

const establishmentsController = require('./establishments.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  establishmentsController.listEstablishments
);

router.get(
  '/next-code',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  establishmentsController.getNextEstablishmentCode
);

router.get(
  '/:id',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  establishmentsController.getEstablishmentById
);

router.post(
  '/',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  establishmentsController.createEstablishment
);

router.put(
  '/:id',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  establishmentsController.updateEstablishment
);

module.exports = router;