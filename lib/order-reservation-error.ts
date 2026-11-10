export type ReservationDatabaseError = {
  code?: string;
  message: string;
};

export type ReservationErrorResponse = {
  status: number;
  error: string;
};

export function getReservationErrorResponse(
  error: ReservationDatabaseError,
): ReservationErrorResponse {
  const message = error.message.toLowerCase();

  if (message.includes("authentication required")) {
    return {
      status: 401,
      error: "Authentication required.",
    };
  }

  if (message.includes("customer account required")) {
    return {
      status: 403,
      error: "Customer access required.",
    };
  }

  if (
    message.includes("offer not found") ||
    message.includes("meal request not found") ||
    message.includes("cannot reserve another customer's request")
  ) {
    return {
      status: 404,
      error: "This offer or meal request could not be found.",
    };
  }

  const reservationConflictMessages = [
    "only submitted offers can be reserved.",
    "you cannot reserve your own offer.",
    "this cook is not currently approved.",
    "a counteroffer is awaiting the cook's response.",
    "this meal request already has an active reservation.",
    "this meal request is no longer open.",
    "the pickup date has already passed.",
    "same-day pickup reservations close at 10:00 am.",
    "negotiated price must remain lower than the original offer.",
    "could not reserve the meal request.",
  ];

  const isKnownReservationConflict =
    reservationConflictMessages.some((knownMessage) =>
      message.includes(knownMessage),
    );

  if (
    error.code === "23505" ||
    (error.code === "P0001" && isKnownReservationConflict)
  ) {
    return {
      status: 409,
      error: "This offer cannot currently be reserved. Please refresh and try again.",
    };
  }

  return {
    status: 500,
    error: "Unable to reserve this offer. Please try again.",
  };
}
