"use client";

import React from "react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";

export default function BreadcrumbDashboard() {
    const pathname = usePathname();
    const pathnames = pathname.split("/").filter(Boolean);
    
    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                {pathnames.map((name, index) => {
                    const href = `/${pathnames.slice(0, index + 1).join("/")}`;
                    const isLast = index === pathnames.length - 1;
                    if (isLast) {
                        return (
                            <BreadcrumbItem key={href}>
                                <BreadcrumbPage>{name}</BreadcrumbPage>
                            </BreadcrumbItem>
                        );
                    }
                    return (
                        <React.Fragment key={href}>
                            <BreadcrumbItem>
                                <BreadcrumbLink href={href}>{name}</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator/>
                        </React.Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
