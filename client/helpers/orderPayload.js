// Helper to build order payloads per contract
function buildOrderPayload(type, formState = {}, otherFields = {}) {
  const payload = { type, ...otherFields };

  if (type === "sales_order") {
    if (formState.manual) {
      // Manual sales: frontend must send orderNumber only and transactionNo placeholder on backend
      if (formState.orderNumber) payload.orderNumber = String(formState.orderNumber).trim();
    } else {
      // Auto sales: omit both orderNumber and transactionNo
      // leave payload without these keys
    }
  } else if (type === "purchase_order") {
    if (formState.manual) {
      // Manual purchase: frontend sends transactionNo only
      if (formState.transactionNo) payload.transactionNo = String(formState.transactionNo).trim();
    } else {
      // Auto purchase: omit transactionNo and orderNumber
    }
  }

  return payload;
}

function buildApprovePayload() {
  return { action: "approve" };
}

function validateManualNumber(value) {
  if (!value || String(value).trim() === "") return false;
  // Simple allowed pattern: uppercase letters, digits, dash
  const re = /^[A-Z0-9-]+$/i;
  return re.test(String(value).trim());
}

module.exports = { buildOrderPayload, buildApprovePayload, validateManualNumber };
