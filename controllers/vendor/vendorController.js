const VendorService = require("../../services/vendor/vendorService");
const catchAsync = require("../../utils/catchAsync");
const logger = require("../../utils/logger");

exports.createVendor = catchAsync(async (req, res) => {
  const childLogger = logger.child({ route: "POST /api/v1/vendors" });
  childLogger.info("API call: Create Vendor", {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    payloadSummary: {
      vendorName: req.body?.vendorName,
      contactPerson: req.body?.contactPerson,
      email: req.body?.email,
      phone: req.body?.phone,
      paymentTerms: req.body?.paymentTerms,
      status: req.body?.status,
      trnNO: req.body?.trnNO,
    },
  });

  const vendor = await VendorService.createVendor(req.body);

  childLogger.info("API response: Vendor created", {
    vendorId: vendor.vendorId,
    _id: vendor._id,
    status: vendor.status,
  });

  res.status(201).json({ success: true, data: vendor });
});

exports.getAllVendors = catchAsync(async (req, res) => {
  const { search, status, paymentTerms } = req.query;
  const vendors = await VendorService.getAllVendors({
    search,
    status,
    paymentTerms,
  });
  res.json({ success: true, data: vendors });
});
exports.getVendorById = catchAsync(async (req, res) => {
  const vendor = await VendorService.getVendorById(req.params.id);
  res.json({ success: true, data: vendor });
});
exports.updateVendor = catchAsync(async (req, res) => {
  const vendor = await VendorService.updateVendor(req.params.id, req.body);
  res.json({ success: true, data: vendor });
});

exports.deleteVendor = catchAsync(async (req, res) => {
  await VendorService.deleteVendor(req.params.id);
  res.json({ success: true, message: "Vendor deleted successfully" });
});
