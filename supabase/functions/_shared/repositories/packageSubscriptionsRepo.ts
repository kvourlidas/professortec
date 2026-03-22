import { NotFoundError } from "../errors.ts";
import type {
  CreatePackageInput,
  UpdatePackageInput,
} from "../types/packageSubscriptions.ts";

export async function insertPackage(
  supabase: any,
  schoolId: string,
  input: CreatePackageInput
) {
  const { data, error } = await supabase
    .from("packages")
    .insert({
      school_id: schoolId,
      name: input.name,
      price: input.price,
      currency: input.currency,
      is_active: input.is_active,
      sort_order: input.sort_order,
      package_type: input.package_type,
      period: input.package_type,
      hours: input.hours,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      avatar_color: input.avatar_color,
      is_custom: input.is_custom,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create package");
  }

  return data;
}

export async function upsertPackages(
  supabase: any,
  schoolId: string,
  input: UpdatePackageInput
) {
  const payload = input.packages.map((p) => ({
    id: p.id,
    school_id: schoolId,
    name: p.name,
    price: p.price,
    currency: p.currency,
    is_active: p.is_active,
    sort_order: p.sort_order,
    package_type: p.package_type,
    period: p.package_type,
    hours: p.hours,
    starts_on: p.package_type === "yearly" ? p.starts_on : null,
    ends_on: p.package_type === "yearly" ? p.ends_on : null,
    avatar_color: p.avatar_color,
    is_custom: p.is_custom,
  }));

  const { error } = await supabase
    .from("packages")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    throw new Error(error.message ?? "Failed to update packages");
  }

  return true;
}

export async function getPackageByIdAndSchoolId(
  supabase: any,
  packageId: string,
  schoolId: string
) {
  const { data, error } = await supabase
    .from("packages")
    .select("id, school_id")
    .eq("id", packageId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Package not found or not accessible");

  return data;
}

export async function deletePackageById(
  supabase: any,
  packageId: string
) {
  const { error } = await supabase
    .from("packages")
    .delete()
    .eq("id", packageId);

  if (error) throw new Error(error.message);

  return true;
}
