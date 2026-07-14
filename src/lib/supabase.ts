import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase는 선택 기능입니다. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가
// 설정되지 않으면 클라우드 저장 UI 전체가 숨겨지고 localStorage만 사용합니다.
// (anon key는 공개용 키이며, 데이터 보호는 Row Level Security가 담당합니다)
const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
