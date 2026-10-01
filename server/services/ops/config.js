// Settings for the Vessel Operations module. Override in server/.env.
const { isValidTimeZone } = require('../../models/ops/Port');

const officeTz = process.env.OPS_OFFICE_TZ || 'Asia/Kolkata'; // operations office time zone (to be confirmed by client)
if (!isValidTimeZone(officeTz)) {
  throw new Error(`OPS_OFFICE_TZ "${officeTz}" is not a valid IANA time zone`);
}

module.exports = {
  OFFICE_TZ: officeTz,
};
