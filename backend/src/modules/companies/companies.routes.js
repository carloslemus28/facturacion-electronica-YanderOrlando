const express = require('express');

const companiesController = require('./companies.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get(
  '/active',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  companiesController.getActiveCompany
);

router.post(
  '/',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  companiesController.createCompany
);

router.put(
  '/:id',
  authenticate,
  authorize('COMPANIES_MANAGE'),
  companiesController.updateCompany
);

module.exports = router;