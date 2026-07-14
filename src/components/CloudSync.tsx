import React, { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Stock, SimulationConfig } from "../types";
import { Cloud, CloudOff, LogOut, Loader2, Mail, Check } from "lucide-react";

interface CloudSyncProps {
  stocks: Stock[];
  config: SimulationConfig;
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
}

/**
 * 이메일 매직링크 로그인 + 포트폴리오 클라우드 동기화 위젯.
 * 로그인하면 클라우드 데이터를 불러오고, 이후 변경사항을 자동 저장한다.
 * Supabase 미설정 시(환경변수 없음) 아무것도 렌더링하지 않는다.
 */
export default function CloudSync({ stocks, config, setStocks, setConfig }: CloudSyncProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");

  // 클라우드 데이터를 불러오기 전에는 저장하지 않기 위한 가드
  const cloudLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) cloudLoadedRef.current = false;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 로그인 직후: 클라우드 → 로컬 (클라우드에 데이터가 있으면 클라우드 우선)
  useEffect(() => {
    if (!supabase || !session || cloudLoadedRef.current) return;
    (async () => {
      setSyncState("loading");
      const { data, error } = await supabase
        .from("portfolios")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!error && data?.data) {
        const saved = data.data as { stocks?: Stock[]; config?: SimulationConfig };
        if (Array.isArray(saved.stocks)) setStocks(saved.stocks);
        if (saved.config) setConfig(saved.config);
      }
      cloudLoadedRef.current = true;
      setSyncState(error ? "error" : "saved");
    })();
  }, [session, setStocks, setConfig]);

  // 변경사항 자동 저장 (1.5초 디바운스)
  useEffect(() => {
    if (!supabase || !session || !cloudLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSyncState("saving");
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await supabase!.from("portfolios").upsert({
        user_id: session.user.id,
        data: { stocks, config },
        updated_at: new Date().toISOString()
      });
      setSyncState(error ? "error" : "saved");
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [stocks, config, session]);

  if (!supabase) return null;

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });
    setSending(false);
    if (!error) setLinkSent(true);
    else alert(`로그인 링크 전송 실패: ${error.message}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  // 로그인 상태 표시
  if (session) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-100 bg-emerald-50/50 rounded-lg text-xs font-semibold text-emerald-700">
        {syncState === "saving" || syncState === "loading" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : syncState === "error" ? (
          <CloudOff className="w-3.5 h-3.5 text-rose-500" />
        ) : (
          <Cloud className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline max-w-32 truncate">{session.user.email}</span>
        <span>{syncState === "saving" ? "저장 중" : syncState === "error" ? "동기화 오류" : "동기화됨"}</span>
        <button onClick={handleLogout} title="로그아웃" className="ml-1 text-emerald-600 hover:text-rose-500 transition">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // 비로그인: 버튼 + 이메일 입력 패널
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-500 rounded-lg transition"
      >
        <Cloud className="w-3.5 h-3.5" />
        클라우드 저장
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-50 space-y-3">
          {linkSent ? (
            <div className="text-center space-y-2 py-2">
              <Check className="w-6 h-6 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-700">로그인 링크를 보냈습니다!</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong>{email}</strong> 메일함에서 링크를 클릭하면 로그인되고, 포트폴리오가 자동으로 클라우드에 저장됩니다.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold text-slate-700">이메일로 간편 로그인</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  비밀번호 없이 메일로 받은 링크 클릭 한 번으로 로그인됩니다. 폰↔PC 어디서든 같은 포트폴리오를 쓸 수 있어요.
                </p>
              </div>
              <form onSubmit={handleSendLink} className="flex gap-1.5">
                <div className="flex-1 relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="이메일 주소"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full text-xs pl-8 pr-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "전송"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
