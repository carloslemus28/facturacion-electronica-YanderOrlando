const { verifyAccessToken } = require('../modules/auth/auth.tokens');
const authService = require('../modules/auth/auth.service');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        message: 'Token de acceso no proporcionado'
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    const { user, roles, permissions } = await authService.getUserRolesAndPermissions(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autorizado'
      });
    }

    req.user = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      pointOfSaleId: user.pointOfSaleId,
      roles,
      permissions,
      pointOfSale: user.pointOfSale
        ? {
            id: user.pointOfSale.id,
            code: user.pointOfSale.code,
            name: user.pointOfSale.name
          }
        : null,
      company: user.pointOfSale?.company
        ? {
            id: user.pointOfSale.company.id,
            nit: user.pointOfSale.company.nit,
            nrc: user.pointOfSale.company.nrc,
            legalName: user.pointOfSale.company.legalName,
            commercialName: user.pointOfSale.company.commercialName,
            establishmentCode: user.pointOfSale.company.establishmentCode,
            environment: user.pointOfSale.company.environment
          }
        : null
    };

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: 'Token inválido o vencido'
    });
  }
};

const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || [];

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        ok: false,
        message: 'No tiene permisos para realizar esta acción'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};