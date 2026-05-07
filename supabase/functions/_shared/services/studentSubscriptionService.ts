import {
  insertStudentSubscription,
  markSubscriptionAsRenewed,
  getSubscriptionByIdAndSchoolId,
  deleteSubscriptionById,
  insertStudentSubscriptionPayment,
  getSubscriptionPaymentByIdAndSchoolId,
  cancelSubscriptionPaymentById,
} from "../repositories/studentSubscriptionRepo.ts";
import type {
  CreateStudentSubscriptionInput,
  DeleteStudentSubscriptionInput,
  CreateStudentSubscriptionPaymentInput,
  CancelStudentSubscriptionPaymentInput,
} from "../types/studentSubscription.ts";

export async function createStudentSubscriptionService(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionInput
) {
  const newSub = await insertStudentSubscription(supabase, schoolId, input);
  if (input.renew_from_sub_id) {
    await markSubscriptionAsRenewed(supabase, input.renew_from_sub_id, schoolId);
  }
  return newSub;
}

export async function deleteStudentSubscriptionService(
  supabase: any,
  schoolId: string,
  input: DeleteStudentSubscriptionInput
) {
  await getSubscriptionByIdAndSchoolId(supabase, input.subscription_id, schoolId);
  await deleteSubscriptionById(supabase, input.subscription_id);
  return { success: true };
}

export async function createStudentSubscriptionPaymentService(
  supabase: any,
  schoolId: string,
  input: CreateStudentSubscriptionPaymentInput
) {
  await getSubscriptionByIdAndSchoolId(supabase, input.subscription_id, schoolId);
  return await insertStudentSubscriptionPayment(supabase, schoolId, input);
}

export async function cancelStudentSubscriptionPaymentService(
  supabase: any,
  schoolId: string,
  input: CancelStudentSubscriptionPaymentInput
) {
  await getSubscriptionPaymentByIdAndSchoolId(supabase, input.payment_id, schoolId);
  await cancelSubscriptionPaymentById(supabase, input.payment_id);
  return { success: true };
}
