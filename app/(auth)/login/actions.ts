"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export type LoginResult = { error: string } | undefined;

export async function loginAction(values: LoginInput): Promise<LoginResult> {
  // Client tarafında da doğrulanır; server tarafı asla client'a güvenmez.
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Girilen bilgiler geçersiz." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn başarılı olduğunda NEXT_REDIRECT fırlatır — o hata yukarı geçmeli.
    if (error instanceof AuthError) {
      return { error: "E-posta veya şifre hatalı." };
    }
    throw error;
  }
}
