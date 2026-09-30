"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
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
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperNext,
  StepperPrev,
  type StepperProps,
  StepperTrigger,
} from "@/components/ui/stepper";
import { checkSlugAvailabilityAction, createOrganizationWithInvitesAction } from "../actions";
import { createOrganizationWithInvitesFormSchema } from "../schemas";
import { OrganizationLogoUpload } from "./organization-logo-upload";
import {
  Field,
  FieldDescription as UiFieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/features/memberships/schemas";

const MAX_INVITES = 10;

type FormSchema = z.infer<typeof createOrganizationWithInvitesFormSchema>;

const steps = [
  {
    value: "organization",
    title: "Datos de la organización",
    description: "Ingrese los datos de la organización",
    fields: ["orgName", "orgSlug"] as const,
  },
  {
    value: "invites",
    title: "Invitar miembros",
    description: "Invite a su equipo",
    fields: ["invites"] as const,
  },
];

export function AddOrganizationStepperForm() {
  const [step, setStep] = React.useState("organization");
  const [orgLogoFile, setOrgLogoFile] = React.useState<File | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = React.useState(false);
  const router = useRouter();

  const form = useForm<FormSchema>({
    resolver: zodResolver(createOrganizationWithInvitesFormSchema),
    defaultValues: {
      orgName: "",
      orgSlug: "",
      invites: [{ email: "", role: "member" }, { email: "", role: "member" }, { email: "", role: "member" }],
    },
    mode: "onChange",
  });

  const { control, setValue, watch } = form;

  // Watchers
  const watchedInvites = watch("invites");

  // Field Array for Invites
  const { fields, append, remove } = useFieldArray({
    control,
    name: "invites",
  });

  const nonEmptyInvitesCount = watchedInvites.filter((inv) => inv.email.trim() !== "").length;
  const canAddMoreInvites = fields.length < MAX_INVITES && nonEmptyInvitesCount < MAX_INVITES;

  const stepIndex = steps.findIndex((s) => s.value === step);

  // Auto-generate slug
  const handleOrgNameChange = React.useCallback((value: string) => {
    if (value && step === "organization") {
      const slug = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      setValue("orgSlug", slug, { shouldValidate: true });
    }
  }, [setValue, step]);

  const checkSlugUniqueness = React.useCallback(async (slug: string): Promise<boolean> => {
    if (!slug || slug.trim() === "") return false;

    setIsCheckingSlug(true);
    try {
      const result = await checkSlugAvailabilityAction(slug);
      return result.isAvailable;
    } catch (error) {
      console.error("Error checking slug availability:", error);
      return false;
    } finally {
      setIsCheckingSlug(false);
    }
  }, []);

  const onValidate: NonNullable<StepperProps["onValidate"]> = React.useCallback(
    async (_value, direction) => {
      if (direction === "prev") return true;

      const stepData = steps.find((s) => s.value === step);
      if (!stepData) return true;

      // Validate fields for current step
      const isValid = await form.trigger(stepData.fields);
      if (!isValid) return false;

      // Special check for slug uniqueness on organization step
      if (step === "organization") {
        const slug = form.getValues("orgSlug");
        const isAvailable = await checkSlugUniqueness(slug);

        if (!isAvailable) {
          form.setError("orgSlug", {
            type: "manual",
            message: "Este identificador en la URL ya está en uso. Elija otro.",
          });
          toast.error("Este identificador en la URL ya está en uso.");
          return false;
        }
      }

      return true;
    },
    [form, step, checkSlugUniqueness],
  );

  const onSubmit = React.useCallback(async (data: FormSchema) => {
    try {
      const formData = new FormData();
      formData.append("name", data.orgName);
      formData.append("slug", data.orgSlug);

      const validInvites = data.invites.filter((inv) => inv.email.trim() !== "");
      formData.append("invites", JSON.stringify(validInvites));

      if (orgLogoFile) {
        formData.append("orgLogoFile", orgLogoFile);
      }

      const result = await createOrganizationWithInvitesAction(formData);

      if (result.success && result.redirectUrl) {
        toast.success("Se creó la organización.");
        router.push(result.redirectUrl);
      } else {
        toast.error(result.error || "No se pudo crear la organización.");
      }
    } catch (error) {
      toast.error("Algo salió mal. Intente de nuevo.");
      console.error(error);
    }
  }, [orgLogoFile, router]);

  return (
    <Form {...form}>
      <form className="w-full space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
        <Stepper value={step} onValueChange={setStep} onValidate={onValidate}>
        <div className="space-y-2 w-48">
            <p className="text-muted-foreground text-sm">
              Paso {stepIndex + 1} de {steps.length}
            </p>
            <StepperList className="flex gap-2">
              {steps.map((step) => (
                <StepperItem
                  key={step.value}
                  value={step.value}
                  className="flex-1"
                >
                  <StepperTrigger className="w-full" asChild>
                    <div role="button" tabIndex={0} className="w-full cursor-pointer focus:outline-none">
                      <StepperIndicator asChild>
                        {stepIndex <= stepIndex ? (
                          <div className="h-1 flex-1 rounded-full transition-colors bg-primary" />
                        ) : (
                          <div className="h-1 flex-1 rounded-full transition-colors bg-muted" />
                        )}
                      </StepperIndicator>
                    </div>
                  </StepperTrigger>
                </StepperItem>
              ))}
            </StepperList>
          </div>

          <StepperContent value="organization">
            <div className="flex flex-col gap-4">
              <div className="space-y-4">
                <Field>
                  <FieldLabel>Logo</FieldLabel>
                  <OrganizationLogoUpload
                    onFileSelect={(file: File | null) => setOrgLogoFile(file)}
                  />
                </Field>

                <FormField
                  control={form.control}
                  name="orgName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la organización</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Constructora Norte"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleOrgNameChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orgSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identificador en la URL</FormLabel>
                      <FormControl>
                        <InputGroup>
                          <InputGroupAddon align="inline-start" className="pr-1!">
                            <InputGroupText className="pr-0.5!">organizations/</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            {...field}
                            placeholder="constructora-norte"
                            readOnly
                            className="bg-muted text-muted-foreground cursor-not-allowed pl-1!"
                          />
                          {isCheckingSlug && (
                            <InputGroupAddon align="inline-end">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </InputGroupAddon>
                          )}
                        </InputGroup>
                      </FormControl>
                      <FormDescription>
                        Identifica a su organización en la dirección web. Debe ser único.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </StepperContent>

          <StepperContent value="invites">
            <div className="space-y-4">
              <FieldSet className="gap-4">
                <div className="flex items-center justify-between">
                  <FieldLegend variant="label">Miembros del equipo</FieldLegend>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto p-0 text-primary hover:bg-transparent hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => append({ email: "", role: "member" })}
                    disabled={!canAddMoreInvites}
                  >
                    + Agregar invitación
                  </Button>
                </div>
                <UiFieldDescription>
                  Agregue hasta {MAX_INVITES} correos electrónicos para invitar a su equipo.
                </UiFieldDescription>
                <FieldGroup className="gap-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <FormField
                        control={form.control}
                        name={`invites.${index}.email`}
                        render={({ field: emailField }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...emailField}
                                placeholder="colega@empresa.hn"
                                type="email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`invites.${index}.role`}
                        render={({ field: roleField }) => (
                          <FormItem>
                            <Select
                              onValueChange={roleField.onChange}
                              defaultValue={roleField.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-[110px]">
                                  <SelectValue placeholder="Rol" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
                                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                                <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => remove(index)}
                          aria-label="Quitar invitación"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </FieldGroup>
              </FieldSet>
            </div>
          </StepperContent>

          <div className="mt-8 flex justify-between">
            <StepperPrev asChild>
              <Button variant="outline">Anterior</Button>
            </StepperPrev>
            <div className="text-muted-foreground text-sm">
              Paso {stepIndex + 1} de {steps.length}
            </div>
            {stepIndex === steps.length - 1 ? (
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Finalizar
              </Button>
            ) : (
              <StepperNext asChild>
                <Button>Siguiente</Button>
              </StepperNext>
            )}
          </div>
        </Stepper>
      </form>
    </Form>
  );
}