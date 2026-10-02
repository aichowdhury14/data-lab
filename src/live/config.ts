// Supabase project that stores the visit counter (project "bd-invest-hub", isolated `datalab` schema).
// The publishable key is meant to be public: it can only call the two `datalab_*` functions,
// which record a visit and return totals. Override with VITE_SUPABASE_URL / VITE_SUPABASE_KEY if needed.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "https://ridfthhslpuenzwcjtpf.supabase.co";
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_iscIdMh7OdB3Jm1Vfx9eeQ_DruK1uWQ";
