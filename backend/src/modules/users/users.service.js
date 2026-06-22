const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

const User = require('./user.model');
const Role = require('./role.model');
const Permission = require('./permission.model');
const PointOfSale = require('../companies/point-of-sale.model');
const Establishment = require('../companies/establishment.model');

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim() || null;
  return value;
};

const validateUsername = (username) => {
  const regex = /^[A-Za-z0-9._-]{4,80}$/;
  return regex.test(username);
};

const sanitizeUser = (user) => {
  const plainUser = user.toJSON();

  delete plainUser.passwordHash;

  const roles = plainUser.roles?.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name
  })) || [];

  const pointOfSale = plainUser.pointOfSale
    ? {
        id: plainUser.pointOfSale.id,
        companyId: plainUser.pointOfSale.companyId,
        establishmentId: plainUser.pointOfSale.establishmentId,
        code: plainUser.pointOfSale.code,
        name: plainUser.pointOfSale.name,
        description: plainUser.pointOfSale.description,
        isActive: plainUser.pointOfSale.isActive,
        establishment: plainUser.pointOfSale.establishment
          ? {
              id: plainUser.pointOfSale.establishment.id,
              establishmentType: plainUser.pointOfSale.establishment.establishmentType,
              establishmentCode: plainUser.pointOfSale.establishment.establishmentCode,
              name: plainUser.pointOfSale.establishment.name
            }
          : null
      }
    : null;

  return {
    id: plainUser.id,
    username: plainUser.username,
    firstName: plainUser.firstName,
    lastName: plainUser.lastName,
    email: plainUser.email,
    pointOfSaleId: plainUser.pointOfSaleId,
    isActive: plainUser.isActive,
    lastLoginAt: plainUser.lastLoginAt,
    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt,
    roles,
    pointOfSale
  };
};

const listUsers = async () => {
  const users = await User.findAll({
    include: [
      {
        model: Role,
        as: 'roles',
        include: [
          {
            model: Permission,
            as: 'permissions'
          }
        ]
      },
      {
        model: PointOfSale,
        as: 'pointOfSale',
        include: [
          {
            model: Establishment,
            as: 'establishment'
          }
        ]
      }
    ],
    order: [['id', 'ASC']]
  });

  return users.map(sanitizeUser);
};

const validatePointOfSaleForUser = async ({ roleCode, pointOfSaleId }) => {
  if (roleCode === 'ADMIN') {
    return null;
  }

  if (roleCode === 'FACTURADOR' && !pointOfSaleId) {
    const error = new Error('El usuario facturador debe tener un punto de venta asignado');
    error.statusCode = 400;
    throw error;
  }

  if (pointOfSaleId) {
    const pointOfSale = await PointOfSale.findByPk(pointOfSaleId);

    if (!pointOfSale) {
      const error = new Error('El punto de venta indicado no existe');
      error.statusCode = 404;
      throw error;
    }

    if (!pointOfSale.isActive) {
      const error = new Error('El punto de venta indicado está inactivo');
      error.statusCode = 400;
      throw error;
    }

    return pointOfSale;
  }

  return null;
};

const createUser = async (data) => {
  const username = normalizeText(data.username);

  if (!username || !validateUsername(username)) {
    const error = new Error('El nombre de usuario debe tener entre 4 y 80 caracteres y solo puede usar letras, números, punto, guion o guion bajo');
    error.statusCode = 400;
    throw error;
  }

  if (!normalizeText(data.firstName)) {
    const error = new Error('El nombre del usuario es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  if (!normalizeText(data.lastName)) {
    const error = new Error('El apellido del usuario es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  if (!data.password || data.password.length < 8) {
    const error = new Error('La contraseña debe tener al menos 8 caracteres');
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await User.findOne({
    where: {
      username
    }
  });

  if (existingUser) {
    const error = new Error('Ya existe un usuario registrado con ese nombre de usuario');
    error.statusCode = 409;
    throw error;
  }

  const email = normalizeText(data.email);

  if (email) {
    const existingEmail = await User.findOne({
      where: {
        email
      }
    });

    if (existingEmail) {
      const error = new Error('Ya existe un usuario registrado con ese correo');
      error.statusCode = 409;
      throw error;
    }
  }

  const roleCode = data.roleCode || 'FACTURADOR';

  const role = await Role.findOne({
    where: {
      code: roleCode
    }
  });

  if (!role) {
    const error = new Error('El rol indicado no existe');
    error.statusCode = 404;
    throw error;
  }

  const pointOfSaleId = roleCode === 'ADMIN'
    ? null
    : data.pointOfSaleId || null;

  await validatePointOfSaleForUser({
    roleCode,
    pointOfSaleId
  });

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await User.create({
    username,
    firstName: normalizeText(data.firstName),
    lastName: normalizeText(data.lastName),
    email,
    passwordHash,
    pointOfSaleId,
    isActive: data.isActive ?? true
  });

  await user.setRoles([role]);

  const createdUser = await User.findByPk(user.id, {
    include: [
      {
        model: Role,
        as: 'roles'
      },
      {
        model: PointOfSale,
        as: 'pointOfSale',
        include: [
          {
            model: Establishment,
            as: 'establishment'
          }
        ]
      }
    ]
  });

  return sanitizeUser(createdUser);
};

const updateUser = async (id, data) => {
  const user = await User.findByPk(id, {
    include: [
      {
        model: Role,
        as: 'roles'
      }
    ]
  });

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const nextUsername = normalizeText(data.username ?? user.username);

  if (!nextUsername || !validateUsername(nextUsername)) {
    const error = new Error('El nombre de usuario debe tener entre 4 y 80 caracteres y solo puede usar letras, números, punto, guion o guion bajo');
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await User.findOne({
    where: {
      username: nextUsername,
      id: {
        [Op.ne]: user.id
      }
    }
  });

  if (existingUser) {
    const error = new Error('Ya existe otro usuario con ese nombre de usuario');
    error.statusCode = 409;
    throw error;
  }

  const nextEmail = normalizeText(data.email ?? user.email);

  if (nextEmail) {
    const existingEmail = await User.findOne({
      where: {
        email: nextEmail,
        id: {
          [Op.ne]: user.id
        }
      }
    });

    if (existingEmail) {
      const error = new Error('Ya existe otro usuario con ese correo');
      error.statusCode = 409;
      throw error;
    }
  }

  const currentRoleCode = user.roles?.[0]?.code || 'FACTURADOR';
  const nextRoleCode = data.roleCode || currentRoleCode;

  const role = await Role.findOne({
    where: {
      code: nextRoleCode
    }
  });

  if (!role) {
    const error = new Error('El rol indicado no existe');
    error.statusCode = 404;
    throw error;
  }

  const nextPointOfSaleId = nextRoleCode === 'ADMIN'
    ? null
    : data.pointOfSaleId ?? user.pointOfSaleId;

  await validatePointOfSaleForUser({
    roleCode: nextRoleCode,
    pointOfSaleId: nextPointOfSaleId
  });

  await user.update({
    username: nextUsername,
    firstName: normalizeText(data.firstName ?? user.firstName),
    lastName: normalizeText(data.lastName ?? user.lastName),
    email: nextEmail,
    pointOfSaleId: nextPointOfSaleId,
    isActive: data.isActive ?? user.isActive
  });

  if (data.roleCode) {
    await user.setRoles([role]);
  }

  const updatedUser = await User.findByPk(id, {
    include: [
      {
        model: Role,
        as: 'roles'
      },
      {
        model: PointOfSale,
        as: 'pointOfSale',
        include: [
          {
            model: Establishment,
            as: 'establishment'
          }
        ]
      }
    ]
  });

  return sanitizeUser(updatedUser);
};

const resetPassword = async (id, newPassword) => {
  const user = await User.findByPk(id);

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await user.update({
    passwordHash
  });

  return true;
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  resetPassword
};