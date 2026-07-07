const LONG_INVALIDATION_DOCUMENT_TYPES = ['01', '11', '14'];

/*
  Cuadro 6 de la Normativa de Cumplimiento DTE v2.0:
  CCF, Nota de Remisión, Nota de Crédito y Nota de Débito se invalidan
  dentro de los diez primeros días hábiles del mes siguiente al período
  tributario en que el documento obtuvo su Sello de Recepción.
*/
const MONTHLY_BUSINESS_DAY_INVALIDATION_DOCUMENT_TYPES = ['03', '04', '05', '06'];
const MONTHLY_INVALIDATION_BUSINESS_DAYS = 10;
const APP_TIME_ZONE = process.env.APP_TIMEZONE || 'America/El_Salvador';

const pad = (value) => String(value).padStart(2, '0');

const getDatePartsInAppTimeZone = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day
  };
};

const getDateKey = ({ year, month, day }) => {
  return `${year}-${pad(month)}-${pad(day)}`;
};

/*
  El Salvador utiliza UTC-06:00 todo el año. Se crea la fecha límite de
  forma explícita para evitar que la zona horaria del servidor modifique el
  calendario tributario del documento.
*/
const buildEndOfAppDay = ({ year, month, day }) => {
  return new Date(`${getDateKey({ year, month, day })}T23:59:59.999-06:00`);
};

const toUtcCalendarDate = ({ year, month, day }) => {
  return new Date(Date.UTC(year, month - 1, day));
};

const fromUtcCalendarDate = (date) => {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
};

const addCalendarDays = (dateParts, days) => {
  const next = toUtcCalendarDate(dateParts);
  next.setUTCDate(next.getUTCDate() + days);
  return fromUtcCalendarDate(next);
};

const getGregorianEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return { year, month, day };
};

/*
  Asuetos nacionales que inciden en los días hábiles de Hacienda. No se
  incluyen asuetos municipales, porque el plazo de invalidación es nacional.
*/
const getNationalHolidayKeys = (year) => {
  const holidays = [
    { year, month: 1, day: 1 },
    { year, month: 5, day: 1 },
    { year, month: 8, day: 6 },
    { year, month: 9, day: 15 },
    { year, month: 11, day: 2 },
    { year, month: 12, day: 25 }
  ];

  const easter = getGregorianEaster(year);

  // Jueves y viernes de Semana Santa son asuetos nacionales.
  holidays.push(
    addCalendarDays(easter, -3),
    addCalendarDays(easter, -2)
  );

  return new Set(holidays.map(getDateKey));
};

const isBusinessDay = (dateParts) => {
  const date = toUtcCalendarDate(dateParts);
  const weekDay = date.getUTCDay();

  if (weekDay === 0 || weekDay === 6) {
    return false;
  }

  return !getNationalHolidayKeys(dateParts.year).has(getDateKey(dateParts));
};

const getFirstBusinessDayDeadlineOfNextMonth = (dateParts) => {
  const firstDayNextMonth = dateParts.month === 12
    ? { year: dateParts.year + 1, month: 1, day: 1 }
    : { year: dateParts.year, month: dateParts.month + 1, day: 1 };

  let candidate = firstDayNextMonth;
  let businessDays = 0;

  while (businessDays < MONTHLY_INVALIDATION_BUSINESS_DAYS) {
    if (isBusinessDay(candidate)) {
      businessDays += 1;
    }

    if (businessDays === MONTHLY_INVALIDATION_BUSINESS_DAYS) {
      return buildEndOfAppDay(candidate);
    }

    candidate = addCalendarDays(candidate, 1);
  }

  /* istanbul ignore next */
  throw new Error('No fue posible calcular el plazo de invalidación');
};

const endOfDay = (date) => {
  const next = new Date(date);

  next.setHours(23, 59, 59, 999);

  return next;
};

const addCalendarMonths = (date, months) => {
  const next = new Date(date);
  const originalDay = next.getDate();

  next.setMonth(next.getMonth() + months);

  if (next.getDate() < originalDay) {
    next.setDate(0);
  }

  return next;
};

const getReceptionDate = (invoice) => {
  return invoice.acceptedAt || invoice.transmittedAt || invoice.issuedAt;
};

const getInvalidationDeadline = (invoice) => {
  const receptionDate = getReceptionDate(invoice);

  if (!receptionDate) {
    const error = new Error('No se encontró fecha de recepción o emisión para validar plazo de anulación');
    error.statusCode = 400;
    throw error;
  }

  const baseDate = new Date(receptionDate);

  if (Number.isNaN(baseDate.getTime())) {
    const error = new Error('La fecha de recepción o emisión del DTE no es válida');
    error.statusCode = 400;
    throw error;
  }

  const documentTypeCode = String(invoice.documentTypeCode);

  if (MONTHLY_BUSINESS_DAY_INVALIDATION_DOCUMENT_TYPES.includes(documentTypeCode)) {
    const receptionDateParts = getDatePartsInAppTimeZone(baseDate);

    if (!receptionDateParts) {
      const error = new Error('No fue posible interpretar la fecha de recepción del DTE');
      error.statusCode = 400;
      throw error;
    }

    return getFirstBusinessDayDeadlineOfNextMonth(receptionDateParts);
  }

  if (LONG_INVALIDATION_DOCUMENT_TYPES.includes(documentTypeCode)) {
    return endOfDay(addCalendarMonths(baseDate, 3));
  }

  const nextDay = new Date(baseDate);
  nextDay.setDate(nextDay.getDate() + 1);

  return endOfDay(nextDay);
};

const validateInvalidationDeadline = (invoice, now = new Date()) => {
  const deadlineAt = getInvalidationDeadline(invoice);
  const canInvalidate = now.getTime() <= deadlineAt.getTime();

  if (!canInvalidate) {
    const error = new Error(
      `Este DTE ya no puede ser invalidado porque venció el plazo permitido. Fecha límite: ${deadlineAt.toLocaleString('es-SV', { timeZone: APP_TIME_ZONE })}`
    );

    error.statusCode = 400;
    error.deadlineAt = deadlineAt;
    throw error;
  }

  return {
    canInvalidate: true,
    deadlineAt
  };
};

module.exports = {
  getInvalidationDeadline,
  validateInvalidationDeadline
};
