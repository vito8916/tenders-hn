import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/marketing/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
	title: "Política de reembolsos y cancelación · Licitaly",
	description:
		"Cómo cancelar un plan de Licitaly, qué pasa con el acceso al cancelar y cuándo corresponde un reembolso.",
};

export default function RefundsPage() {
	return (
		<LegalPage
			title="Política de reembolsos y cancelación"
			summary="Puede cancelar su plan en cualquier momento. Si no le convence, le devolvemos su primer pago dentro de los 7 días siguientes."
		>
			<h2>1. Cancelación</h2>
			<ul>
				<li>
					El propietario de la organización puede cancelar el plan en cualquier momento desde Configuración ›
					Facturación.
				</li>
				<li>
					Al cancelar, la organización conserva el acceso hasta el final del período ya pagado. No se realizan
					más cobros después de esa fecha.
				</li>
				<li>
					Al terminar el período, la organización queda en modo de solo lectura: sus datos se conservan y puede
					volver a contratar un plan cuando quiera.
				</li>
			</ul>

			<h2>2. Reembolso del primer pago</h2>
			<p>
				Si solicita el reembolso dentro de los 7 días siguientes a su primer pago, le devolvemos el monto
				completo de ese pago.
			</p>

			<h2>3. Cuándo no hay reembolso</h2>
			<ul>
				<li>Pagos de renovación y pagos posteriores al primero.</li>
				<li>Meses usados parcialmente, aunque cancele antes de que termine el período.</li>
				<li>Créditos de IA no utilizados, que tampoco se acumulan para el ciclo siguiente.</li>
			</ul>

			<h2>4. Cómo solicitar un reembolso</h2>
			<p>
				Escríbanos a <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a> desde el correo
				de su cuenta, indicando el nombre de la organización y la fecha del pago. El reembolso se procesa a
				través de {siteConfig.merchantOfRecord}, nuestro comerciante registrado (merchant of record), y se
				acredita en el mismo método de pago que usó. El tiempo en que aparece en su cuenta depende de su banco o
				emisor de la tarjeta.
			</p>

			<h2>5. Pagos fallidos</h2>
			<p>
				Si no se puede cobrar una renovación, la organización conserva el acceso durante 7 días. Después, queda
				en modo de solo lectura hasta que se actualice el método de pago.
			</p>

			<h2>6. Códigos de descuento</h2>
			<p>
				Los pilotos pueden usar códigos de descuento al contratar. Esta política se aplica igual a los planes
				contratados con descuento, sobre el monto efectivamente pagado.
			</p>

			<p>
				Lo demás sobre planes y pagos está en los <Link href="/terminos">Términos del servicio</Link>.
			</p>
		</LegalPage>
	);
}
