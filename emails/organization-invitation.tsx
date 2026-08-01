import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
} from "@react-email/components";

interface OrganizationInvitationEmailProps {
    orgName: string;
    inviterName?: string | null;
    role: string;
    acceptUrl: string;
    expiresAt: Date;
}

export default function OrganizationInvitationEmail({
    orgName,
    inviterName,
    role,
    acceptUrl,
    expiresAt,
}: OrganizationInvitationEmailProps) {
    const invitedBy = inviterName ? `${inviterName} has invited you` : "You have been invited";
    const expiryDate = expiresAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <Html>
            <Head />
            <Preview>{`${invitedBy} to join ${orgName}`}</Preview>
            <Body style={body}>
                <Container style={container}>
                    <Heading style={heading}>Join {orgName}</Heading>
                    <Text style={paragraph}>
                        {invitedBy} to join <strong>{orgName}</strong> as{" "}
                        <strong>{role}</strong>.
                    </Text>
                    <Section style={buttonSection}>
                        <Button style={button} href={acceptUrl}>
                            Accept invitation
                        </Button>
                    </Section>
                    <Text style={paragraph}>
                        Or copy and paste this link into your browser:
                    </Text>
                    <Text style={link}>{acceptUrl}</Text>
                    <Hr style={hr} />
                    <Text style={footer}>
                        This invitation expires on {expiryDate}. If you were not
                        expecting it, you can safely ignore this email.
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

const body = {
    backgroundColor: "#f6f6f6",
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: "24px 0",
};

const container = {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    margin: "0 auto",
    maxWidth: "480px",
    padding: "40px",
};

const heading = {
    color: "#111111",
    fontSize: "22px",
    fontWeight: 600 as const,
    margin: "0 0 16px",
};

const paragraph = {
    color: "#333333",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 16px",
};

const buttonSection = {
    margin: "24px 0",
    textAlign: "center" as const,
};

const button = {
    backgroundColor: "#111111",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 600 as const,
    padding: "12px 24px",
    textDecoration: "none",
};

const link = {
    color: "#2563eb",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 16px",
    wordBreak: "break-all" as const,
};

const hr = {
    borderColor: "#e5e5e5",
    margin: "24px 0 16px",
};

const footer = {
    color: "#888888",
    fontSize: "12px",
    lineHeight: "18px",
    margin: 0,
};
