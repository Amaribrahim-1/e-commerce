// Egyptian mobile number in local form only: "01", then the operator digit
// (0 Vodafone, 1 e&, 2 Orange, 5 WE), then 8 digits = 11 digits in total.
// +20 / 0020 are rejected so every number is stored in one form.
// Shared by Zod (edge validation) and the User schema `match` (last defence).
export const EGYPT_PHONE_REGEX = /^(01[0125][0-9]{8})$/;
