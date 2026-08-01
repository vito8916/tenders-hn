"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldError,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldContent,
	FieldTitle,
} from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupText,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import {createProjectAction} from "../actions";
import {createProjectFormSchema} from "../schemas";
function AddProjectForm({
	handleOpenChange,
	orgSlug,
	orgId,
}: {
	handleOpenChange: (open: boolean) => void;
	orgSlug: string;
	orgId: string;
}) {
	const form = useForm<z.infer<typeof createProjectFormSchema>>({
		resolver: zodResolver(createProjectFormSchema),
		defaultValues: {
			name: "",
			description: "",
			visibility: "private",
			status: "active",
		},
	});

	async function onSubmit(data: z.infer<typeof createProjectFormSchema>) {
		/*Call Server Action createProjectAction */
		try {
			await createProjectAction(data, orgId, orgSlug);
			toast.success("Project created successfully");
		} catch (error) {
			toast.error("Failed to create project");
			console.error(error);
		} finally {
			form.reset();
			handleOpenChange(false);
		}
	}

	return (
		<form id="form-rhf-add-project" onSubmit={form.handleSubmit(onSubmit)}>
			<FieldGroup>
				<FieldSet>
					<FieldGroup>
						<Controller
							name="name"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor="form-rhf-project-name">
										Project Name
									</FieldLabel>
									<Input
										{...field}
										id="form-rhf-project-name"
										aria-invalid={fieldState.invalid}
										placeholder="Project name"
										autoComplete="off"
									/>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
						<Controller
							name="description"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid}>
									<FieldLabel htmlFor="form-rhf-project-description">
										Description
									</FieldLabel>
									<InputGroup>
										<InputGroupTextarea
											{...field}
											id="form-rhf-project-description"
											placeholder="Project description"
											rows={6}
											className="min-h-24 resize-none"
											aria-invalid={fieldState.invalid}
										/>
										<InputGroupAddon align="block-end">
											<InputGroupText className="tabular-nums">
												{(field.value?.length ?? 0)}/2000
												characters
											</InputGroupText>
										</InputGroupAddon>
									</InputGroup>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</FieldSet>
				<FieldSeparator />
				<FieldSet>
					<FieldLegend>Visibility</FieldLegend>
					<FieldDescription>
						The visibility of the project
					</FieldDescription>
					<FieldGroup>
						<Controller
							name="visibility"
							control={form.control}
							render={({ field, fieldState }) => (
								<FieldSet>
									<RadioGroup
										name={field.name}
										value={field.value}
										onValueChange={field.onChange}
									>
										{["private", "public"].map(
											(visibility) => (
												<FieldLabel
													key={visibility}
													htmlFor={`form-rhf-radiogroup-${visibility}`}
												>
													<Field
														orientation="horizontal"
														data-invalid={
															fieldState.invalid
														}
													>
														<FieldContent>
															<FieldTitle>
																{visibility}
															</FieldTitle>
														</FieldContent>
														<RadioGroupItem
															value={visibility}
															id={`form-rhf-radiogroup-${visibility}`}
															aria-invalid={
																fieldState.invalid
															}
														/>
													</Field>
												</FieldLabel>
											)
										)}
									</RadioGroup>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</FieldSet>
							)}
						/>
					</FieldGroup>
				</FieldSet>
				<FieldSeparator />
				<FieldSet>
					<FieldLegend>Status</FieldLegend>
					<FieldDescription>
						The status of the project
					</FieldDescription>
					<FieldGroup>
						<Controller
							name="status"
							control={form.control}
							render={({ field, fieldState }) => (
								<FieldSet>
									<RadioGroup
										name={field.name}
										value={field.value}
										onValueChange={field.onChange}
									>
										{["active", "inactive"].map(
											(status) => (
												<FieldLabel
													key={status}
													htmlFor={`form-rhf-radiogroup-${status}`}
												>
													<Field
														orientation="horizontal"
														data-invalid={
															fieldState.invalid
														}
													>
														<FieldContent>
															<FieldTitle>
																{status}
															</FieldTitle>
														</FieldContent>
														<RadioGroupItem
															value={status}
															id={`form-rhf-radiogroup-${status}`}
															aria-invalid={
																fieldState.invalid
															}
														/>
													</Field>
												</FieldLabel>
											)
										)}
									</RadioGroup>
									{fieldState.invalid && (
										<FieldError
											errors={[fieldState.error]}
										/>
									)}
								</FieldSet>
							)}
						/>
					</FieldGroup>
				</FieldSet>
				<FieldSet>
					<Button type="submit" form="form-rhf-add-project" disabled={form.formState.isSubmitting}>
						{form.formState.isSubmitting ? (
							<div className="flex items-center gap-2">
								<LoaderCircle className="animate-spin" />
								Creating project...
							</div>
						) : (
							"Create Project"
						)}
					</Button>
				</FieldSet>
			</FieldGroup>
		</form>
	);
}

export default AddProjectForm;
