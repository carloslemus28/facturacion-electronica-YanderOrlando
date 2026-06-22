const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const User = require('../users/user.model');
const Role = require('../users/role.model');
const Permission = require('../users/permission.model');
const RefreshToken = require('./refresh-token.model');
const PointOfSale = require('../companies/point-of-sale.model');
const Company = require('../companies/company.model');
const Establishment = require('../companies/establishment.model');

const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken
} = require('./auth.tokens');

const DEFAULT_ALLOWED_DOCUMENT_TYPES = ['01', '03'];

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const getActiveCompanyForAdmin = async () => {
  const company = await Company.findOne({
    where: {
      isActive: true
    },
    order: [['id', 'ASC']]
  });

  return company;
};

const getUserRolesAndPermissions = async (userId) => {
  const user = await User.findByPk(userId, {
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
            model: Company,
            as: 'company'
          },
          {
            model: Establishment,
            as: 'establishment'
          }
        ]
      }
    ]
  });

  if (!user) {
    return {
      user: null,
      roles: [],
      permissions: []
    };
  }

  const roles = user.roles.map((role) => role.code);

  const permissions = [
    ...new Set(
      user.roles.flatMap((role) =>
        role.permissions.map((permission) => permission.code)
      )
    )
  ];

  return {
    user,
    roles,
    permissions
  };
};

const buildCompanyPayload = (company) => {
  if (!company) return null;

  return {
    id: company.id,
    nit: company.nit,
    nrc: company.nrc,
    legalName: company.legalName,
    commercialName: company.commercialName,
    economicActivityCode: company.economicActivityCode,
    economicActivityName: company.economicActivityName,
    establishmentType: company.establishmentType,
    establishmentCode: company.establishmentCode,
    pointOfSaleCode: company.pointOfSaleCode,
    environment: company.environment,
    email: company.email,
    phone: company.phone,
    departmentCode: company.departmentCode,
    departmentName: company.departmentName,
    districtName: company.districtName,
    municipalityCode: company.municipalityCode,
    municipalityName: company.municipalityName,
    addressComplement: company.addressComplement,
    allowedDocumentTypes: company.allowedDocumentTypes || DEFAULT_ALLOWED_DOCUMENT_TYPES
  };
};

const buildEstablishmentPayload = (establishment) => {
  if (!establishment) return null;

  return {
    id: establishment.id,
    companyId: establishment.companyId,
    establishmentType: establishment.establishmentType,
    establishmentCode: establishment.establishmentCode,
    name: establishment.name,
    departmentCode: establishment.departmentCode,
    departmentName: establishment.departmentName,
    districtName: establishment.districtName,
    municipalityCode: establishment.municipalityCode,
    municipalityName: establishment.municipalityName,
    addressComplement: establishment.addressComplement,
    isActive: establishment.isActive
  };
};

const buildAuthenticatedUser = async (user, roles, permissions) => {
  let company = user.pointOfSale?.company || null;

  if (!company && roles.includes('ADMIN')) {
    company = await getActiveCompanyForAdmin();
  }

  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    pointOfSaleId: user.pointOfSaleId,
    roles,
    permissions,

    pointOfSale: user.pointOfSale
      ? {
          id: user.pointOfSale.id,
          companyId: user.pointOfSale.companyId,
          establishmentId: user.pointOfSale.establishmentId,
          code: user.pointOfSale.code,
          name: user.pointOfSale.name,
          description: user.pointOfSale.description,
          establishment: buildEstablishmentPayload(user.pointOfSale.establishment)
        }
      : null,

    company: buildCompanyPayload(company)
  };
};

const login = async ({ username, password, ipAddress, userAgent }) => {
  const normalizedUsername = String(username || '').trim();

  if (!normalizedUsername || !password) {
    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findOne({
    where: {
      username: normalizedUsername
    },
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
      }
    ]
  });

  if (!user || !user.isActive) {
    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  const validPassword = await user.comparePassword(password);

  if (!validPassword) {
    const error = new Error('Credenciales inválidas');
    error.statusCode = 401;
    throw error;
  }

  const roles = user.roles.map((role) => role.code);

  const permissions = [
    ...new Set(
      user.roles.flatMap((role) =>
        role.permissions.map((permission) => permission.code)
      )
    )
  ];

  const accessToken = createAccessToken(user, roles, permissions);
  const { token: refreshToken, tokenId } = createRefreshToken(user);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    tokenId,
    tokenHash: hashToken(refreshToken),
    userId: user.id,
    expiresAt,
    ipAddress,
    userAgent
  });

  user.lastLoginAt = new Date();
  await user.save();

  const { user: fullUser } = await getUserRolesAndPermissions(user.id);

  return {
    accessToken,
    refreshToken,
    user: await buildAuthenticatedUser(fullUser, roles, permissions)
  };
};

const refresh = async ({ refreshToken, ipAddress, userAgent }) => {
  if (!refreshToken) {
    const error = new Error('Refresh token no proporcionado');
    error.statusCode = 401;
    throw error;
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    const customError = new Error('Refresh token inválido o vencido');
    customError.statusCode = 401;
    throw customError;
  }

  const storedToken = await RefreshToken.findOne({
    where: {
      tokenId: payload.jti,
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: {
        [Op.gt]: new Date()
      }
    }
  });

  if (!storedToken) {
    const error = new Error('Sesión inválida o expirada');
    error.statusCode = 401;
    throw error;
  }

  const { user, roles, permissions } = await getUserRolesAndPermissions(payload.sub);

  if (!user || !user.isActive) {
    const error = new Error('Usuario no disponible');
    error.statusCode = 401;
    throw error;
  }

  const accessToken = createAccessToken(user, roles, permissions);
  const { token: newRefreshToken, tokenId: newTokenId } = createRefreshToken(user);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  storedToken.revokedAt = new Date();
  storedToken.replacedByTokenId = newTokenId;
  await storedToken.save();

  await RefreshToken.create({
    tokenId: newTokenId,
    tokenHash: hashToken(newRefreshToken),
    userId: user.id,
    expiresAt,
    ipAddress,
    userAgent
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: await buildAuthenticatedUser(user, roles, permissions)
  };
};

const logout = async (refreshToken) => {
  if (!refreshToken) return;

  try {
    const payload = verifyRefreshToken(refreshToken);

    await RefreshToken.update(
      {
        revokedAt: new Date()
      },
      {
        where: {
          tokenId: payload.jti,
          tokenHash: hashToken(refreshToken),
          revokedAt: null
        }
      }
    );
  } catch (error) {
    return;
  }
};

module.exports = {
  login,
  refresh,
  logout,
  getUserRolesAndPermissions
};