// this file is imported by some test vats, so don't import any non-pure
// modules

import { assert } from '@agoric/assert';
import { QCLASS } from '@endo/marshal';

export function extractMessage(vatDeliverObject) {
  const [type, ...vdoargs] = vatDeliverObject;
  assert.equal(type, 'message', `util.js .extractMessage`);
  const [facetID, msg] = vdoargs;
  const { method, args, result } = msg;
  return { facetID, method, args, result };
}

export function capdata(body, slots = []) {
  return harden({ body, slots });
}

function marshalBigIntReplacer(_, arg) {
  if (typeof arg === 'bigint') {
    return { [QCLASS]: 'bigint', digits: String(arg) };
  }
  return arg;
}

export function capargs(args, slots = []) {
  return capdata(JSON.stringify(args, marshalBigIntReplacer), slots);
}

export function ignore(p) {
  p.then(
    () => 0,
    () => 0,
  );
}
