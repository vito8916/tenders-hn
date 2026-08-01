import { AddOrganizationStepperForm } from '@/features/organizations/components/add-organization'

export default function CreateOrganizationPage() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Create Organization</h1>
      <AddOrganizationStepperForm />
    </div>
  )
}
