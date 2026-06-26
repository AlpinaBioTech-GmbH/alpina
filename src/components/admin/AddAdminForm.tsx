// src/components/admin/AddAdminForm.tsx
// Adds an email to the admin allowlist. The person can then sign in via magic
// link; no password or invite email is sent from here.
"use client";

import { useActionState, useRef, useEffect } from "react";
import { addAdmin, type ActionState } from "@/app/admin/(dashboard)/admins/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddAdminForm() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    addAdmin,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful add.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="name@example.com" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" name="name" placeholder="Full name" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="admin"
          className="h-9 rounded-none border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add admin"}
      </Button>

      {state ? (
        <p
          className={
            state.ok
              ? "text-sm text-muted-foreground sm:col-span-4"
              : "text-sm text-destructive sm:col-span-4"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
