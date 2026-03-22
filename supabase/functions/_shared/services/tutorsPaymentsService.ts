import {
  upsertTutorPaymentProfile,
  insertTutorBonus,
  insertTutorPayment,
  getTutorPaymentByIdAndSchoolId,
  updateTutorPaymentById,
  deleteTutorPaymentById,
} from "../repositories/tutorsPaymentsRepo.ts";
import type {
  CreateTutorPaymentInput,
  UpdateTutorPaymentInput,
  DeleteTutorPaymentInput,
} from "../types/tutorsPayments.ts";

export async function createTutorPaymentService(
  supabase: any,
  schoolId: string,
  input: CreateTutorPaymentInput
) {
  // Optionally upsert profile first
  if (input.profile) {
    await upsertTutorPaymentProfile(supabase, schoolId, input.profile);
  }

  // Optionally insert bonus record
  if (input.bonus) {
    await insertTutorBonus(supabase, schoolId, input.bonus);
  }

  // Always insert the payment row
  const payment = await insertTutorPayment(supabase, schoolId, input.payment);
  return payment;
}

export async function updateTutorPaymentService(
  supabase: any,
  schoolId: string,
  input: UpdateTutorPaymentInput
) {
  await getTutorPaymentByIdAndSchoolId(supabase, input.payment_id, schoolId);
  await updateTutorPaymentById(supabase, input);
  return { success: true };
}

export async function deleteTutorPaymentService(
  supabase: any,
  schoolId: string,
  input: DeleteTutorPaymentInput
) {
  await getTutorPaymentByIdAndSchoolId(supabase, input.payment_id, schoolId);
  await deleteTutorPaymentById(supabase, input.payment_id);
  return { success: true };
}
