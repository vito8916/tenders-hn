import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { AppearanceForm } from "@/components/settings/appearance-form";
import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";

async function AccountSettingsContent() {
    const { profile } = await getCurrentUserWithProfile();

    return (
        <>
            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-medium">Profile</h2>
                    <p className="text-sm text-muted-foreground">
                        How you appear to other members.
                    </p>
                </div>
                <ProfileForm profileInfo={profile} />
            </section>

            <Separator />

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-medium">Password</h2>
                    <p className="text-sm text-muted-foreground">
                        Update the password used to sign in.
                    </p>
                </div>
                <PasswordForm />
            </section>

            <Separator />

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-medium">Appearance</h2>
                    <p className="text-sm text-muted-foreground">
                        Choose how the app looks on this device.
                    </p>
                </div>
                <AppearanceForm />
            </section>
        </>
    );
}

export default function AccountSettingsPage() {
    return (
        <Suspense fallback={<SettingsFormSkeleton sections={3} />}>
            <AccountSettingsContent />
        </Suspense>
    );
}
