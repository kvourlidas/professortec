import { ValidationError } from "../errors.ts";
import type {
  CreatePackageInput,
  UpdatePackageInput,
  DeletePackageInput,
  PackageType,
} from "../types/packageSubscriptions.ts";

const VALID_TYPES: PackageType[] = ["hourly", "monthly", "yearly"];

function validateType(t: any): PackageType {
  if (!VALID_TYPES.includes(t)) throw new ValidationError(`Invalid package_type: ${t}`);
  return t as PackageType;
}

export function validateCreatePackageBody(body: any): CreatePackageInput {
  const name = body?.name?.trim?.();
  if (!name) throw new ValidationError("Missing name");

  const price = Number(body?.price);
  if (!Number.isFinite(price) || price < 0) throw new ValidationError("Invalid price");

  const package_type = validateType(body?.package_type);
  const hours = package_type === "hourly" ? Number(body?.hours) : null;
  if (package_type === "hourly" && (!hours || hours < 1)) throw new ValidationError("Hours must be >= 1 for hourly packages");

  return {
    name,
    price,
    currency: body?.currency?.trim?.() || "EUR",
    is_active: !!body?.is_active,
    sort_order: Number(body?.sort_order ?? 0),
    package_type,
    hours: package_type === "hourly" ? Math.floor(hours!) : null,
    starts_on: body?.starts_on?.trim?.() || null,
    ends_on: body?.ends_on?.trim?.() || null,
    avatar_color: body?.avatar_color?.trim?.() || "#6366f1",
    is_custom: !!body?.is_custom,
  };
}

export function validateUpdatePackageBody(body: any): UpdatePackageInput {
  const packages = body?.packages;
  if (!Array.isArray(packages) || packages.length === 0) {
    throw new ValidationError("Missing or empty packages array");
  }

  const validated = packages.map((p: any, i: number) => {
    const id = p?.id?.trim?.();
    if (!id) throw new ValidationError(`Missing id at index ${i}`);
    const name = p?.name?.trim?.();
    if (!name) throw new ValidationError(`Missing name at index ${i}`);
    const price = Number(p?.price);
    if (!Number.isFinite(price) || price < 0) throw new ValidationError(`Invalid price at index ${i}`);
    const package_type = validateType(p?.package_type);
    const hours = package_type === "hourly" ? Number(p?.hours) : null;
    if (package_type === "hourly" && (!hours || hours < 1)) throw new ValidationError(`Hours must be >= 1 for hourly packages at index ${i}`);

    return {
      id,
      name,
      price,
      currency: p?.currency?.trim?.() || "EUR",
      is_active: !!p?.is_active,
      sort_order: Number(p?.sort_order ?? 0),
      package_type,
      hours: package_type === "hourly" ? Math.floor(hours!) : null,
      starts_on: p?.starts_on?.trim?.() || null,
      ends_on: p?.ends_on?.trim?.() || null,
      avatar_color: p?.avatar_color?.trim?.() || "#6366f1",
      is_custom: !!p?.is_custom,
    };
  });

  return { packages: validated };
}

export function validateDeletePackageBody(body: any): DeletePackageInput {
  const package_id = body?.package_id?.trim?.();
  if (!package_id) throw new ValidationError("Missing package_id");
  return { package_id };
}