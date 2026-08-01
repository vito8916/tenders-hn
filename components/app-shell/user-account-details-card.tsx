import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { capitalizeText, cn, getInitials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Calendar, ImageIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Profile } from "@/features/profiles/schemas";

export default function UserAccountDetailsCard({
	userProfileInfo,
}: {
	userProfileInfo: Profile;
}) {
	return (
		<Card className="w-full">
			<CardHeader className="pb-4">
				<div className="flex items-center space-x-4">
					<Avatar className="h-16 w-16">
						<AvatarImage src={userProfileInfo?.avatarUrl ?? ""} />
						<AvatarFallback className="text-lg font-semibold bg-primary/10">
							{getInitials(userProfileInfo?.fullName)}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1">
						<CardTitle className="text-2xl mb-2">
							Welcome back,{" "}
							{capitalizeText(
								userProfileInfo?.fullName ?? "N/A"
							)}
						</CardTitle>
						<Badge
							variant="outline"
							className={cn(
								userProfileInfo?.status === "active"
									? "bg-green-500/50 border-green-500/50"
									: "bg-destructive/10",
								"text-xs"
							)}
						>
							{userProfileInfo?.status}
						</Badge>
					</div>
				</div>
			</CardHeader>

			<Separator />

			<CardContent className="p-y-6">
				<h3 className="mb-4">Account Details</h3>
				<div className="grid gap-4">
					<div className="flex items-center space-x-3 text-sm">
						<Mail className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Email:</span>
						<span className="font-medium">
							{userProfileInfo?.email}
						</span>
					</div>

					<div className="flex items-center space-x-3 text-sm">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">
							Member since:
						</span>
						<span className="font-medium">
							{userProfileInfo?.createdAt
								? formatDate(userProfileInfo.createdAt.toISOString())
								: "N/A"}
						</span>
					</div>

					{/* <div className="flex items-center space-x-3 text-sm">
								<Clock className="h-4 w-4 text-muted-foreground" />
								<span className="text-muted-foreground">
									Last active:
								</span>
								<span className="font-medium">
									{user?.last_sign_in_at
										? formatDate(user.last_sign_in_at)
										: "N/A"}
								</span>
							</div> */}

					<div className="flex items-center space-x-3 text-sm">
						<ImageIcon className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">
							Avatar Url:
						</span>
						<span className="font-medium">
							{userProfileInfo?.avatarUrl
								? userProfileInfo.avatarUrl
								: "N/A"}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
