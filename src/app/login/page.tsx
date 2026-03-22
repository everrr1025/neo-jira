"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setIsLoading(false);
    } else {
      router.push("/");
      router.refresh(); // Crucial to load layouts with new session
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg shadow-slate-200/50 w-full max-w-md border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-inner shadow-blue-700">
            <span className="text-white text-xl font-bold italic tracking-tighter">NJ</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Sign in to Neo-Jira</h1>
        <p className="text-sm text-slate-500 text-center mb-8">Enter your credentials to access your workspace.</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium mb-6 border border-red-100 text-center animate-in fade-in duration-200">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors"
              placeholder="admin@neo-jira.local"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-md transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Default credentials:<br />
            <span className="font-semibold text-slate-700 mt-1 inline-block">admin@neo-jira.local / admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
