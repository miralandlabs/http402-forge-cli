import type { Keypair } from '@solana/web3.js';
import { createPay402Fetch } from '@pr402/buyer-typescript/fetch-with-payment';
import { PR402_FACILITATOR_URL_PREVIEW } from '@pr402/buyer-typescript/pr402-defaults';

export function createForgePayFetch(
  payer: Keypair,
  facilitatorBase?: string,
  fetchFn: typeof fetch = fetch,
): typeof fetch {
  const base = (facilitatorBase ?? PR402_FACILITATOR_URL_PREVIEW)
    .replace(/\/api\/v1\/facilitator\/?$/, '')
    .replace(/\/$/, '');
  return createPay402Fetch(fetchFn, {
    payer,
    defaultFacilitatorBaseUrl: base,
  });
}

export { createPay402Fetch, PR402_FACILITATOR_URL_PREVIEW };
