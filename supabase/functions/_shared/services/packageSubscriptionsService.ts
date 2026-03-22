import {
  insertPackage,
  upsertPackages,
  getPackageByIdAndSchoolId,
  deletePackageById,
} from "../repositories/packageSubscriptionsRepo.ts";
import type {
  CreatePackageInput,
  UpdatePackageInput,
  DeletePackageInput,
} from "../types/packageSubscriptions.ts";

export async function createPackageService(
  supabase: any,
  schoolId: string,
  input: CreatePackageInput
) {
  return await insertPackage(supabase, schoolId, input);
}

export async function updatePackageService(
  supabase: any,
  schoolId: string,
  input: UpdatePackageInput
) {
  return await upsertPackages(supabase, schoolId, input);
}

export async function deletePackageService(
  supabase: any,
  schoolId: string,
  input: DeletePackageInput
) {
  await getPackageByIdAndSchoolId(supabase, input.package_id, schoolId);
  await deletePackageById(supabase, input.package_id);
  return { success: true };
}
