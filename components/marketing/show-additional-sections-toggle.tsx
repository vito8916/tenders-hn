"use client";

import { Activity, useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Pricing from "@/components/marketing/pricing";
import Features1 from "@/components/marketing/features1";

export default function ShowAdditionalSectionsToggle({}) {
	const [showAdditionalSections, setShowAdditionalSections] = useState<boolean>(false);

	return (
		<>
			<div className="flex items-center space-x-2 mb-4">
				<Checkbox
					id="show-additional-sections"
					checked={showAdditionalSections}
					onCheckedChange={(checked) =>
						setShowAdditionalSections(
							checked === "indeterminate" ? false : checked
						)
					}
				/>
				<Label htmlFor="show-additional-sections">
					Show Additional Sections
				</Label>
			</div>
			<Activity mode={showAdditionalSections ? "visible" : "hidden"}>
                <Features1 />
				<Pricing />
			</Activity>
		</>
	);
}
