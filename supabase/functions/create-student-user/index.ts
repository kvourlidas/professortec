import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  school_id: string;
  student_id: string; // existing student row id (created already)
  email?: string | null;
  phone?: string | null;
  password: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to the caller (JWT) so we can validate who is calling
    const supabaseCaller = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    });

    // Admin client (service role) for creating auth users + updating students
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1) Verify caller is logged in
    const { data: callerAuth, error: callerAuthErr } =
      await supabaseCaller.auth.getUser();

    if (callerAuthErr || !callerAuth?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerAuth.user.id;

    // 2) Verify caller is an admin for the same school (adjust to your schema)
    // Assumes table: profiles(id uuid PK = auth user id, school_id uuid, role text)
    const { data: prof, error: profErr } = await supabaseCaller
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", callerId)
      .maybeSingle();

    if (profErr || !prof) {
      return new Response(JSON.stringify({
        error: "Profile not found",
        debug: { callerId }
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IMPORTANT: adjust role checks if your app uses different roles
    const allowedRoles = new Set(["admin", "school_admin", "school_owner"]);

    if (!prof.role || !allowedRoles.has(prof.role)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden (insufficient role)",
          debug: { callerId, role: prof.role, school_id: prof.school_id },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }


    // Body parse
    const body = (await req.json()) as Body;

    if (!body.school_id || !body.student_id || !body.password) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure admin is operating only within their own school
    if (prof.school_id !== body.school_id) {
      return new Response(JSON.stringify({
        error: "Forbidden (school mismatch)",
        debug: { callerSchoolId: prof.school_id, bodySchoolId: body.school_id }
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must have at least one identifier
    if (!body.email && !body.phone) {
      return new Response(JSON.stringify({ error: "Provide email or phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.password.trim().length < 6) {
      return new Response(JSON.stringify({ error: "Password too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Create Auth user
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        password: body.password,
        email_confirm: true, // change to false if you want verification flow
        phone_confirm: true,
        user_metadata: {
          role: "student_parent",
          school_id: body.school_id,
          student_id: body.student_id,
        },
      });

    if (createErr || !created?.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? "Auth create failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = created.user.id;

    // 4) Link student row (and keep a plaintext copy of the password so
    // staff can read it back to a student who forgets it — auth still
    // checks the hashed password above; this column is admin-convenience only)
    const { error: updErr } = await supabaseAdmin
      .from("students")
      .update({ auth_user_id: userId, current_password: body.password })
      .eq("id", body.student_id)
      .eq("school_id", body.school_id);

    if (updErr) {
      // Rollback auth user if linking fails
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
