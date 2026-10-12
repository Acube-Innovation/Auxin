// Finds voyages / masters that use a record, so it is not deleted from under them.
// Cancelled voyages are ignored; every other voyage (draft, active, completed history) blocks deletion.
const mongoose = require('mongoose');

const LIVE = { status: { $ne: 'CANCELLED' } };
const asIds = (ids) => (Array.isArray(ids) ? ids : [ids]).filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(String(id)));

// Lazy requires: these models are only registered once the ops module is loaded
const models = () => ({
  Voyage: require('../../models/ops/Voyage'),
  PortCall: require('../../models/ops/PortCall'),
  Vessel: require('../../models/ops/Vessel'),
  Port: require('../../models/ops/Port'),
});

async function voyageNosFor(voyageIds) {
  const { Voyage } = models();
  const voyages = await Voyage.find({ _id: { $in: voyageIds }, ...LIVE }).select('voyageNo').sort({ voyageNo: 1 }).lean();
  return voyages.map((v) => v.voyageNo);
}

// Port calls are only counted when their voyage is not cancelled
async function liveVoyageIdsFromPortCalls(filter) {
  const { PortCall } = models();
  const ids = await PortCall.distinct('voyage', filter);
  return ids;
}

const summarise = (label, voyageNos, extra = []) => {
  const parts = [];
  if (voyageNos.length) parts.push(`${voyageNos.length} voyage(s): ${voyageNos.slice(0, 5).join(', ')}${voyageNos.length > 5 ? '…' : ''}`);
  parts.push(...extra);
  return parts.length ? `${label} is used by ${parts.join('; ')}` : null;
};

async function vesselUsage(id) {
  const { Voyage } = models();
  const voyages = await Voyage.find({ vessel: { $in: asIds(id) }, ...LIVE }).select('voyageNo').lean();
  return summarise('This vessel', voyages.map((v) => v.voyageNo));
}

async function portUsage(id) {
  const { Voyage } = models();
  const ids = asIds(id);
  const fromCalls = await liveVoyageIdsFromPortCalls({ port: { $in: ids } });
  const direct = await Voyage.distinct('_id', { $or: [{ 'delivery.port': { $in: ids } }, { 'redelivery.port': { $in: ids } }] });
  return summarise('This port', await voyageNosFor([...fromCalls, ...direct]));
}

// Clients: charterers, owners, brokers, bunker supplier, port-call agents, vessel owners/brokers, port default agents
async function clientUsage(idOrIds) {
  const { Voyage, Vessel, Port } = models();
  const ids = asIds(idOrIds);
  if (!ids.length) return null;
  const direct = await Voyage.distinct('_id', {
    $or: [{ charterers: { $in: ids } }, { owners: { $in: ids } }, { brokers: { $in: ids } }, { 'bunker.supplier': { $in: ids } }],
  });
  const fromCalls = await liveVoyageIdsFromPortCalls({ agent: { $in: ids } });
  const vessels = await Vessel.find({ $or: [{ owners: { $in: ids } }, { ownersBroker: { $in: ids } }] }).select('name').lean();
  const ports = await Port.find({ defaultAgents: { $in: ids } }).select('name').lean();
  const extra = [];
  if (vessels.length) extra.push(`vessel(s) ${vessels.map((v) => v.name).join(', ')}`);
  if (ports.length) extra.push(`port(s) ${ports.map((p) => p.name).join(', ')} as default agent`);
  return summarise(ids.length > 1 ? 'A selected client' : 'This client', await voyageNosFor([...direct, ...fromCalls]), extra);
}

// Employees: voyage operators (task assignees are added with voyage tasks in step 5)
async function employeeUsage(idOrIds) {
  const { Voyage } = models();
  const ids = asIds(idOrIds);
  if (!ids.length) return null;
  const voyages = await Voyage.find({ operators: { $in: ids }, ...LIVE }).select('voyageNo').lean();
  return summarise(ids.length > 1 ? 'A selected employee' : 'This employee', voyages.map((v) => v.voyageNo));
}

module.exports = { vesselUsage, portUsage, clientUsage, employeeUsage };
