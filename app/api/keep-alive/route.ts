import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Use NEXT_PUBLIC_ vars (already set) or fallback to non-public versions
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing Supabase configuration",
        },
        { status: 500 }
      );
    }

    // Simple lightweight query to pack_options table (small lookup table)
    // This counts as activity for Supabase and prevents pausing
    const { data, error } = await supabase
      .from("pack_options")
      .select("id")
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      status: "alive",
      timestamp: new Date().toISOString(),
      data: data ? "connected" : "no data",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: (err as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
