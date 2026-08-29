import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-posta adresi gerekli.")
    .pipe(z.email("Geçerli bir e-posta adresi girin.")),
  password: z.string().min(1, "Şifre gerekli."),
});

export type LoginInput = z.infer<typeof loginSchema>;
