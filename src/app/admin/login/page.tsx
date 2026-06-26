// Magic-link sign-in for the admin area. No password: enter an allowlisted
// email, receive a one-time link. The form posts to the sendMagicLink action.
"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ERRORS: Record<string, string> = {
  not_allowed: "That account is not authorized for the admin area.",
  link_invalid: "That sign-in link was invalid or has expired. Request a new one.",
  not_configured: "The admin area is not configured yet. Add Supabase keys to continue.",
};

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const errorKey = params.get("error");
  const errorMsg = errorKey ? ERRORS[errorKey] : null;

  const [state, action, pending] = useActionState<LoginState | null, FormData>(
    sendMagicLink,
    null,
  );

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-heading)]">
            Admin sign-in
          </CardTitle>
          <CardDescription>
            Enter your email and we will send a one-time sign-in link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg ? (
            <p className="mb-4 text-sm text-destructive">{errorMsg}</p>
          ) : null}

          {state?.ok ? (
            <p className="text-sm text-muted-foreground">{state.message}</p>
          ) : (
            <form action={action} className="grid gap-4">
              <input type="hidden" name="next" value={next} />
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </div>
              {state && !state.ok ? (
                <p className="text-sm text-destructive">{state.message}</p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Sending..." : "Send sign-in link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function AdminLoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
