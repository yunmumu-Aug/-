"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestPage() {
  const [result, setResult] = useState("");

  async function testRawSignup() {
    setResult("测试中...");
    try {
      const res = await fetch(
        "https://tpwrzkiztrkhxyebdgsi.supabase.co/auth/v1/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({
            email: "test" + Date.now() + "@test.com",
            password: "password123",
          }),
        }
      );
      const text = await res.text();
      setResult(`状态: ${res.status}\n${text}`);
    } catch (e: any) {
      setResult(`异常: ${e.message}`);
    }
  }

  async function testWithSDK() {
    setResult("SDK 测试中...");
    const { data, error } = await supabase.auth.signUp({
      email: "sdk" + Date.now() + "@test.com",
      password: "password123",
    });
    setResult(`SDK: ${error ? JSON.stringify(error) : JSON.stringify(data)}`);
  }

  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h1>Supabase 连接测试</h1>
      <button onClick={testRawSignup} style={{ margin: 10, padding: 10 }}>
        原生 fetch 测试
      </button>
      <button onClick={testWithSDK} style={{ margin: 10, padding: 10 }}>
        SDK 测试
      </button>
      <pre style={{ marginTop: 20, padding: 20, background: "#f5f5f5", whiteSpace: "pre-wrap" }}>
        {result || "点击按钮开始测试"}
      </pre>
    </div>
  );
}
