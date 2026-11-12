
import type { AuthResult } from "@/lib/supabase/auth.server";
import type {
  EcoCashChargeResult,
} from "./ecocash-provider.server";
import type {
  PaymentRepository,
} from "./ecocash-payment-types";

export interface EcoCashPaymentHandlerDependencies {
  authenticate: () => Promise<AuthResult>;

  createRepository: () => PaymentRepository;

  ensureProviderConfigured: () => void;

  initiateCharge: (input: {
    clientCorrelator: string;
    referenceCode: string;
    endUserId: string;
    amount: string | number;
    currency: string;
  }) => Promise<EcoCashChargeResult>;

  createId: () => string;

  now: () => string;
}

export interface EcoCashPaymentHandlerInput {
  request: Request;
  orderId: string;
}

export interface EcoCashPaymentHandler {
  (
    input: EcoCashPaymentHandlerInput,
  ): Promise<Response>;
}
