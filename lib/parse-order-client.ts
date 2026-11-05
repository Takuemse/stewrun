export const PICKUP_HUBS = ['Eastgate', 'Joina City', 'Avondale'] as const
export type PickupHub = (typeof PICKUP_HUBS)[number]

export type ParseConfidence = 'high' | 'medium' | 'low'

export interface ParsedMealRequest {
  items: Array<{
    name: string
    quantity: number
    price_each: number
  }>
  hub: PickupHub
  pickup_time: string
  confidence: ParseConfidence
  notes: string
}

export class ParseOrderApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ParseOrderApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isParsedMealRequest(value: unknown): value is ParsedMealRequest {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false
  }

  const validItems = value.items.every(
    (item) =>
      isRecord(item) &&
      typeof item.name === 'string' &&
      item.name.trim() !== '' &&
      typeof item.quantity === 'number' &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      typeof item.price_each === 'number' &&
      Number.isFinite(item.price_each) &&
      item.price_each > 0,
  )

  return (
    value.items.length > 0 &&
    validItems &&
    typeof value.hub === 'string' &&
    PICKUP_HUBS.some((hub) => hub === value.hub) &&
    typeof value.pickup_time === 'string' &&
    /^(0[8-9]|1\d|2[0-3]):[0-5]\d$/.test(value.pickup_time) &&
    (value.confidence === 'high' ||
      value.confidence === 'medium' ||
      value.confidence === 'low') &&
    typeof value.notes === 'string'
  )
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    return null
  }

  return null
}

function messageForStatus(status: number, detail: string | null): string {
  switch (status) {
    case 400:
      return 'Please check your meal request and try again.'
    case 401:
      return 'Please sign in with your customer account to interpret a meal request.'
    case 403:
      return 'Meal requests are available to customer accounts only.'
    case 422:
      return detail || 'We could not interpret that request. Try describing your meal another way.'
    case 502:
      return 'Meal interpretation is temporarily unavailable. Please try again shortly.'
    default:
      return detail || 'Something went wrong while interpreting your request.'
  }
}

export async function parseMealRequest(input: string): Promise<ParsedMealRequest> {
  let response: Response

  try {
    response = await fetch('/api/parse-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
  } catch {
    throw new ParseOrderApiError(
      'We could not connect to StewRun. Check your connection and try again.',
    )
  }

  if (!response.ok) {
    const detail = await readErrorMessage(response)
    throw new ParseOrderApiError(messageForStatus(response.status, detail), response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ParseOrderApiError('We received an unreadable response. Please try again.')
  }

  if (!isParsedMealRequest(payload)) {
    throw new ParseOrderApiError('The meal interpretation was incomplete. Please try again.')
  }

  return payload
}
