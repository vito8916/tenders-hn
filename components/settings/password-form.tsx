"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { passwordFormSchema, type PasswordFormValues } from "@/lib/validations/settings";
import { useState } from "react";
import { updatePasswordAction } from "@/features/auth/actions";
import { LoaderCircle } from "lucide-react";

// Default values for the form
const defaultValues: Partial<PasswordFormValues> = {
  password: "",
  confirmPassword: "",
};

export function PasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form with Zod schema and default values.
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues,
    mode: "onChange",
  });

  async function onSubmit(values: PasswordFormValues) {
    setIsLoading(true);
    try {
      // Call the server action
      const result = await updatePasswordAction(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        toast.success("Password updated successfully");

        // Reset the form after successful password change
        form.reset(defaultValues);
      }
    } catch (error) {
      console.error("Password update error:", error);
      toast.error("Failed to update password. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormDescription>
                Your password must be at least 8 characters long and include uppercase, lowercase, number, and special character.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormDescription>
                Please confirm your new password.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </Form>
  );
} 