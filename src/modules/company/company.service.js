'use strict';
const Company = require('../../models/Company');
const ApiError = require('../../utils/ApiError');
const { writeAudit } = require('../../utils/audit');

/** Returns the caller's own company (multi-tenant: a user only ever sees their company). */
async function getCompany(user) {
  const company = await Company.findById(user.company);
  if (!company) throw ApiError.notFound('Company not found');
  return company;
}

/** Updates the caller's company. Nested objects (address/settings) are merged, not replaced. */
async function updateCompany(user, data, ip) {
  const company = await Company.findById(user.company);
  if (!company) throw ApiError.notFound('Company not found');

  const before = company.toObject();

  if (data.name !== undefined) company.name = data.name;
  if (data.industry !== undefined) company.industry = data.industry;
  if (data.currency !== undefined) company.currency = data.currency;
  if (data.address) company.address = { ...before.address, ...data.address };
  if (data.settings) company.settings = { ...before.settings, ...data.settings };

  await company.save();

  await writeAudit({
    company: user.company,
    actor: user.id,
    action: 'company.update',
    entity: 'Company',
    entityId: company._id,
    before,
    after: company.toObject(),
    ip,
  });
  return company;
}

module.exports = { getCompany, updateCompany };
