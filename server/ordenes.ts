import { randomBytes } from 'node:crypto';

// Las referencias de las órdenes que cobra Wompi (ecp_…) y el id con que
// quedan en payments.stripe_session_id. Las usan /api/checkout y el pago
// de la pauta de fabricantes; las dos terminan en el mismo settle().

export const REF_RE = /^ecp_[a-f0-9]{32}$/;
export const newRef = () => `ecp_${randomBytes(16).toString('hex')}`;
/** El id de orden que guardamos en payments.stripe_session_id. */
export const orderId = (ref: string) => `wompi_${ref}`;
