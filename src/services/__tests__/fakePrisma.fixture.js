/**
 * Minimal in-memory stand-in for the Prisma calls the settlement code makes.
 *
 * Supports equality filters, `{ not: x }`, `orderBy: { createdAt: 'desc' }`,
 * numeric `{ increment }` / `{ decrement }` updates, the unique
 * (gateway, providerTxnId) index on fee payments, the unique
 * (provider, eventId) index on gateway events, and transaction rollback.
 * Enough to exercise settlement end to end without a database.
 */

const matches = (row, where = {}) =>
  Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && 'not' in expected) {
      return row[key] !== expected.not;
    }
    return row[key] === expected;
  });

const applyData = (row, data) => {
  const next = { ...row };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && 'increment' in value) next[key] = row[key] + value.increment;
    else if (value && typeof value === 'object' && 'decrement' in value) next[key] = row[key] - value.decrement;
    else next[key] = value;
  }
  return next;
};

const pick = (row, select) => {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.keys(select).reduce((acc, key) => ({ ...acc, [key]: row[key] }), {});
};

const uniqueViolation = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
const notFound = () => Object.assign(new Error('Record to update not found'), { code: 'P2025' });

const createFakePrisma = ({ invoices = [], payments = [] } = {}) => {
  let state = {
    invoices: invoices.map((i) => ({ isActive: true, ...i })),
    payments: payments.map((p, index) => ({ createdAt: new Date(index), needsReview: false, ...p })),
    ledger: [],
    events: []
  };
  let sequence = 0;

  const assertUniquePayment = (candidate, ignoreId) => {
    if (!candidate.gateway || !candidate.providerTxnId) return;
    const clash = state.payments.find((p) =>
      p.id !== ignoreId && p.gateway === candidate.gateway && p.providerTxnId === candidate.providerTxnId);
    if (clash) throw uniqueViolation();
  };

  const feePayment = {
    findFirst: jest.fn(async ({ where, orderBy } = {}) => {
      let rows = state.payments.filter((p) => matches(p, where));
      if (orderBy && orderBy.createdAt === 'desc') rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
      return pick(rows[0]);
    }),
    findUnique: jest.fn(async ({ where }) => pick(state.payments.find((p) => p.id === where.id))),
    create: jest.fn(async ({ data }) => {
      sequence += 1;
      const row = { id: `payment-${sequence}`, createdAt: new Date(1000 + sequence), needsReview: false, ...data };
      assertUniquePayment(row);
      state.payments.push(row);
      return pick(row);
    }),
    update: jest.fn(async ({ where, data }) => {
      const index = state.payments.findIndex((p) => p.id === where.id);
      if (index === -1) throw notFound();
      const next = applyData(state.payments[index], data);
      assertUniquePayment(next, next.id);
      state.payments[index] = next;
      return pick(next);
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      state.payments = state.payments.map((p) => {
        if (!matches(p, where)) return p;
        const next = applyData(p, data);
        assertUniquePayment(next, next.id);
        count += 1;
        return next;
      });
      return { count };
    }),
    count: jest.fn(async ({ where } = {}) => state.payments.filter((p) => matches(p, where)).length)
  };

  const feeInvoice = {
    findFirst: jest.fn(async ({ where, select } = {}) =>
      pick(state.invoices.find((i) => matches(i, where)), select)),
    findUnique: jest.fn(async ({ where, select }) =>
      pick(state.invoices.find((i) => i.id === where.id), select)),
    update: jest.fn(async ({ where, data, select }) => {
      const index = state.invoices.findIndex((i) => i.id === where.id);
      if (index === -1) throw notFound();
      state.invoices[index] = applyData(state.invoices[index], data);
      return pick(state.invoices[index], select);
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      state.invoices = state.invoices.map((i) => {
        if (!matches(i, where)) return i;
        count += 1;
        return applyData(i, data);
      });
      return { count };
    })
  };

  const gatewayEvent = {
    create: jest.fn(async ({ data }) => {
      if (state.events.some((e) => e.provider === data.provider && e.eventId === data.eventId)) {
        throw uniqueViolation();
      }
      state.events.push(data);
      return data;
    }),
    findUnique: jest.fn(async ({ where }) => {
      const key = where.provider_eventId;
      return state.events.find((e) => e.provider === key.provider && e.eventId === key.eventId) || null;
    })
  };

  const tx = {
    feePayment,
    feeInvoice,
    gatewayEvent,
    feeLedgerEntry: { create: jest.fn(async ({ data }) => { state.ledger.push(data); return data; }) },
    feeAdjustment: {
      create: jest.fn(async ({ data }) => {
        sequence += 1;
        return { id: `adjustment-${sequence}`, ...data };
      })
    }
  };

  // Transactions run one at a time, the way Postgres makes a second writer on
  // the same row or unique key wait for the first to commit. A callback that
  // throws leaves no trace, like a rolled back transaction.
  let queue = Promise.resolve();
  let openTransactions = 0;
  const $transaction = jest.fn((callback) => {
    const run = queue.then(async () => {
      const snapshot = structuredClone(state);
      openTransactions += 1;
      try {
        return await callback(tx);
      } catch (error) {
        state = snapshot;
        throw error;
      } finally {
        openTransactions -= 1;
      }
    });
    queue = run.catch(() => {});
    return run;
  });

  // The top-level client reads the same data (so tests can stub a read on
  // `tx` and see it from both clients), but refuses to write while a
  // transaction is open: in Postgres that write would commit on its own and
  // survive the rollback, which the snapshot above would otherwise hide.
  const WRITE_METHODS = new Set(['create', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
  const topLevel = Object.fromEntries(Object.entries(tx).map(([model, methods]) => [
    model,
    new Proxy(methods, {
      get: (target, name) => {
        const method = target[name];
        if (!WRITE_METHODS.has(name)) return method;
        return (...args) => {
          if (openTransactions > 0) {
            throw new Error(`prisma.${model}.${String(name)} used while a transaction is open; use the transaction client`);
          }
          return method(...args);
        };
      }
    })
  ]));

  return {
    prisma: { ...topLevel, $transaction },
    tx,
    getState: () => state
  };
};

module.exports = { createFakePrisma };
