"use client";

import React, { useState } from "react";
import { GlassCard } from "@developer-hub/liquid-glass";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInput, LoginSchema } from "@/type/user/LoginForm";
import { toast } from "react-toastify";
import Link from "next/link";
import { useUserStore } from "@/stores/userStore";

export default function HomePage() {
  const router = useRouter();

  const { setUser } = useUserStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail || "Login failed");
        return;
      }

      const result = await res.json();
      // console.log("Login successful:", result);

      toast.success("Login successful!");

      setUser(result.session.user.id);

      // store token
      localStorage.setItem("user_id", result.session.user.id);
      localStorage.setItem("notebook_id", result.session.user.notebook_id);
      localStorage.setItem("access_token", result.session.access_token);

      router.push("/content/editor/67fdb5f7a429e9c91a8eb8b68a4f64d5");
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <img
        src="/assets/login4.png"
        className="absolute top-0 left-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <GlassCard blurAmount={0} cornerRadius={100} shadowMode={false}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col items-center p-6 px-15 space-y-4 text-center w-[560px] max-w-[94vw] h-120"
          >
            <h3 className="text-4xl font-bold text-white">Welcome Back</h3>

            <div className="text-lg text-[white] leading-snug drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)] max-w-[480px] text-center">
              <p>YOUR NOTES. YOUR KNOWLEDGE.</p>
              <p>SMARTER WITH AI</p>
            </div>

            {/* Email */}
            <input
              type="text"
              placeholder="Email"
              {...register("email")}
              className="w-full py-3 px-5 rounded-full bg-white/20 text-black outline-none
              focus:bg-white/50
              autofill:bg-white/50
                scheme-dark
              "
            />
            <div className="min-h-2">
              {errors.email && (
                <p className="text-[#ffcc66] text-sm font-bold">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <input
              type="password"
              placeholder="Password"
              {...register("password")}
              className="w-full py-3 px-5 rounded-full bg-white/20 text-black outline-none"
            />
            <div className="min-h-2">
              {errors.password && (
                <p className="text-[#ffcc66] text-sm font-bold">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="py-3 mt-2 w-full bg-[#7a4900] text-white rounded-full hover:bg-orange-600 transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Loading..." : "Login"}
            </button>
            <p className="text-sm text-white/90 mt-6">
              Don’t have an account?{" "}
              <Link href="/register" className="text-black/80 hover:underline">
                Create one now
              </Link>
            </p>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
