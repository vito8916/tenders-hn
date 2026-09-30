import {
    Body,
    Button,
    Column,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Row,
    Section,
    Text,
} from "@react-email/components";
import { ROLE_LABELS, type OrgRole } from "@/features/memberships/schemas";

interface OrganizationInvitationEmailProps {
    orgName: string;
    inviterName?: string | null;
    role: OrgRole;
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
    const invitedBy = inviterName ? `${inviterName} lo invitó` : "Lo invitaron";
    const expiryDate = expiresAt.toLocaleDateString("es-HN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Tegucigalpa",
    });
    const details = [
        { label: "Organización", value: orgName },
        { label: "Rol", value: ROLE_LABELS[role] },
        { label: "Vence", value: expiryDate },
    ];

    return (
        <Html lang="es">
            <Head>
                <meta name="color-scheme" content="light" />
                <meta name="supported-color-schemes" content="light" />
            </Head>
            <Preview>{`${invitedBy} a unirse a ${orgName} en Tenders HN`}</Preview>
            <Body style={body}>
                <Container style={container}>
                    <Section style={card}>
                        <Section style={header}>
                            <Text style={wordmark}>
                                Tenders<span style={wordmarkAccent}> HN</span>
                            </Text>
                        </Section>
                        <Section style={content}>
                            <Heading as="h1" style={heading}>
                                Únase a {orgName}
                            </Heading>
                            <Text style={paragraph}>
                                {invitedBy} a colaborar en Tenders HN, donde su equipo revisa las oportunidades de
                                HonduCompras que corresponden a lo que vende su empresa.
                            </Text>
                            <Section style={detailsPanel}>
                                {details.map((detail) => (
                                    <Row key={detail.label} style={detailRow}>
                                        <Column style={detailLabel}>{detail.label}</Column>
                                        <Column style={detailValue}>{detail.value}</Column>
                                    </Row>
                                ))}
                            </Section>
                            <Section style={buttonSection}>
                                <Button style={button} href={acceptUrl}>
                                    Aceptar invitación
                                </Button>
                            </Section>
                            <Text style={fallback}>
                                Si el botón no funciona, copie y pegue este enlace en su navegador:
                                <br />
                                <Link href={acceptUrl} style={fallbackLink}>
                                    {acceptUrl}
                                </Link>
                            </Text>
                            <Text style={note}>Si no esperaba esta invitación, puede ignorar este correo.</Text>
                        </Section>
                    </Section>
                    <Text style={footer}>Tenders HN · Oportunidades de compras públicas en Honduras</Text>
                </Container>
            </Body>
        </Html>
    );
}

// Shared with supabase/templates/*.html and the send-notification-emails function; keep them in step.
const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const body = {
    backgroundColor: "#f4f4f5",
    fontFamily,
    margin: 0,
    padding: "32px 12px",
};

const container = {
    margin: "0 auto",
    maxWidth: "560px",
    width: "100%",
};

const card = {
    backgroundColor: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: "12px",
};

const header = {
    borderBottom: "1px solid #f4f4f5",
    padding: "20px 32px",
};

const wordmark = {
    color: "#09090b",
    fontSize: "18px",
    fontWeight: 700 as const,
    letterSpacing: "-0.01em",
    lineHeight: "24px",
    margin: 0,
};

const wordmarkAccent = {
    color: "#2563eb",
};

const content = {
    padding: "32px",
};

const heading = {
    color: "#09090b",
    fontSize: "22px",
    fontWeight: 600 as const,
    letterSpacing: "-0.01em",
    lineHeight: "30px",
    margin: "0 0 12px",
};

const paragraph = {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 24px",
};

const detailsPanel = {
    backgroundColor: "#fafafa",
    border: "1px solid #e4e4e7",
    borderRadius: "8px",
    padding: "8px 16px",
};

const detailRow = {
    width: "100%",
};

const detailLabel = {
    color: "#71717a",
    fontSize: "14px",
    lineHeight: "20px",
    padding: "6px 0",
    width: "120px",
};

const detailValue = {
    color: "#09090b",
    fontSize: "14px",
    fontWeight: 500 as const,
    lineHeight: "20px",
    padding: "6px 0",
};

const buttonSection = {
    margin: "28px 0",
};

const button = {
    backgroundColor: "#09090b",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600 as const,
    lineHeight: "20px",
    padding: "12px 24px",
    textDecoration: "none",
};

const fallback = {
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0 0 16px",
};

const fallbackLink = {
    color: "#2563eb",
    textDecoration: "underline",
    wordBreak: "break-all" as const,
};

const note = {
    borderTop: "1px solid #f4f4f5",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
    paddingTop: "16px",
};

const footer = {
    color: "#a1a1aa",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "16px 0 0",
    textAlign: "center" as const,
};
