const usersService = require('./users.service');

const listUsers = async (req, res, next) => {
  try {
    const users = await usersService.listUsers();

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      users
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await usersService.createUser(req.body);

    res.status(201).json({
      ok: true,
      message: 'Usuario registrado correctamente',
      user
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await usersService.updateUser(id, req.body);

    res.status(200).json({
      ok: true,
      message: 'Usuario actualizado correctamente',
      user
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres'
      });
    }

    await usersService.resetPassword(id, password);

    res.status(200).json({
      ok: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  resetPassword
};