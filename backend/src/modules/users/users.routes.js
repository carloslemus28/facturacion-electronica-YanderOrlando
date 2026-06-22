const express = require('express');

const usersController = require('./users.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize('USERS_MANAGE'),
  usersController.listUsers
);

router.post(
  '/',
  authenticate,
  authorize('USERS_MANAGE'),
  usersController.createUser
);

router.put(
  '/:id',
  authenticate,
  authorize('USERS_MANAGE'),
  usersController.updateUser
);

router.patch(
  '/:id/reset-password',
  authenticate,
  authorize('USERS_MANAGE'),
  usersController.resetPassword
);

module.exports = router;