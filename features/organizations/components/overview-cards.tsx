import Link from "next/link";
import { FolderKanban, Mail, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewCardsProps {
    orgSlug: string;
    projectsCount: number;
    membersCount: number;
    pendingInvitationsCount: number | null;
}

interface StatCard {
    title: string;
    value: number;
    icon: typeof Users;
    href: string;
    hint: string;
}

export function OverviewCards({
    orgSlug,
    projectsCount,
    membersCount,
    pendingInvitationsCount,
}: OverviewCardsProps) {
    const cards: StatCard[] = [
        {
            title: "Projects",
            value: projectsCount,
            icon: FolderKanban,
            href: `/organizations/${orgSlug}/projects`,
            hint: "Active in this organization",
        },
        {
            title: "Members",
            value: membersCount,
            icon: Users,
            href: `/organizations/${orgSlug}/members`,
            hint: "People with access",
        },
    ];

    if (pendingInvitationsCount !== null) {
        cards.push({
            title: "Pending invitations",
            value: pendingInvitationsCount,
            icon: Mail,
            href: `/organizations/${orgSlug}/members`,
            hint: "Waiting to be accepted",
        });
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
                <Link key={card.title} href={card.href}>
                    <Card className="transition-colors hover:bg-accent/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <card.icon className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
                            <p className="text-xs text-muted-foreground">{card.hint}</p>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    );
}
