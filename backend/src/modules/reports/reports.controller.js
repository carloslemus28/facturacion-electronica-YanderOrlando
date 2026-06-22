const reportsService = require('./reports.service');

const exportDteExcel = async (req, res, next) => {
  try {
    const { documentTypeCode, startDate, endDate, status } = req.query;

    const workbook = await reportsService.buildExcelReport({
      documentTypeCode,
      startDate,
      endDate,
      status
    });

    const fileName = reportsService.buildReportFileName({
      documentTypeCode,
      startDate,
      endDate
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);

    res.end();
  } catch (error) {
    next(error);
  }
};

const previewDteReport = async (req, res, next) => {
  try {
    const { documentTypeCode, startDate, endDate, status } = req.query;

    const invoices = await reportsService.listInvoicesForReportPreview({
      documentTypeCode,
      startDate,
      endDate,
      status
    });

    res.set('Cache-Control', 'no-store');

    res.status(200).json({
      ok: true,
      invoices
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportDteExcel,
  previewDteReport
};