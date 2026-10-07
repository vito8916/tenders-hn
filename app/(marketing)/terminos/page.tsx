import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/marketing/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
	title: "Términos del servicio",
	description:
		"Condiciones de uso de Licitaly: el servicio, las cuentas y organizaciones, los planes y pagos, el uso aceptable y los límites de responsabilidad.",
};

export default function TermsPage() {
	return (
		<LegalPage
			title="Términos del servicio"
			summary="Estas condiciones regulan el uso de Licitaly. Al crear una cuenta o contratar un plan, usted las acepta."
		>
			<h2>1. Quién presta el servicio</h2>
			<p>
				Licitaly es un servicio ofrecido por {siteConfig.sellerName}, persona natural domiciliada en Honduras
				(en adelante, «nosotros»). En estos términos, «usted» es la persona que crea una cuenta y, cuando
				corresponde, la empresa u organización en cuyo nombre la utiliza. Puede escribirnos a{" "}
				<a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
			</p>

			<h2>2. Descripción del servicio</h2>
			<p>
				Licitaly recopila los procesos de compra publicados en HonduCompras, lee sus documentos cuando es
				posible y los compara con el perfil de su empresa para mostrarle oportunidades relevantes. El servicio
				incluye búsquedas guardadas, reportes descargables, avisos por correo y un chat con inteligencia
				artificial que responde preguntas sobre los procesos citando sus fuentes.
			</p>

			<h2>3. Origen de los datos y alcance de los resultados</h2>
			<p>
				La información de los procesos proviene de HonduCompras, el portal público de compras del Estado de
				Honduras. <strong>Licitaly no está afiliado a la ONCAE ni a ninguna institución del Gobierno de Honduras, ni cuenta con su respaldo.</strong>
			</p>
			<ul>
				<li>
					La información puede estar incompleta, retrasada o contener errores, ya sea en la fuente o en nuestro
					procesamiento. Antes de tomar decisiones o presentar una oferta, usted debe verificar siempre los datos
					en la{" "}
					<a href={siteConfig.honducomprasUrl} target="_blank" rel="noopener noreferrer">
						fuente oficial
					</a>
					; cada resultado enlaza a su publicación en HonduCompras.
				</li>
				<li>
					La relevancia asignada a cada proceso y las respuestas o resúmenes generados por inteligencia
					artificial pueden contener errores. No constituyen asesoría legal, técnica ni de contratación pública,
					y no certifican que su empresa cumpla los requisitos de un proceso.
				</li>
				<li>No garantizamos que usted gane ningún proceso de contratación.</li>
			</ul>

			<h2>4. Cuentas y organizaciones</h2>
			<p>
				Para usar el servicio necesita una cuenta personal con datos verdaderos. Usted es responsable de
				mantener segura su contraseña y de la actividad realizada con su cuenta.
			</p>
			<p>
				Cada empresa trabaja dentro de una organización. Quien la crea es su propietario: puede invitar miembros,
				asignarles roles y es el único que administra el plan y la facturación. El propietario es responsable de
				las personas que invita y del uso que hagan del servicio dentro de su organización.
			</p>

			<h2>5. Planes, pagos y créditos de IA</h2>
			<ul>
				<li>
					Los planes son suscripciones mensuales por organización, en dólares estadounidenses (USD), con los
					impuestos incluidos en el precio mostrado. Los precios vigentes son los que se muestran en la sección{" "}
					<Link href="/#planes">Planes</Link> y en Configuración › Facturación al momento de contratar.
				</li>
				<li>
					Los pagos los procesa {siteConfig.merchantOfRecord}, que actúa como comerciante registrado (merchant of
					record): cobra el pago, emite la factura o el recibo y gestiona los impuestos aplicables. Nosotros no
					vemos ni guardamos los números de su tarjeta.
				</li>
				<li>
					La suscripción se renueva automáticamente cada mes hasta que usted la cancele.
				</li>
				<li>
					Cada plan incluye una cantidad de créditos de IA por ciclo mensual de facturación, que se usan en
					funciones como el chat. El matching, los reportes y los avisos no consumen créditos. Los créditos se
					otorgan al inicio de cada ciclo; los que no se usan no se acumulan para el ciclo siguiente ni son
					reembolsables.
				</li>
				<li>
					El propietario puede cambiar de plan desde Configuración › Facturación; la diferencia se prorratea. Un
					cambio a un plan menor puede rechazarse hasta que el uso de la organización (miembros e invitaciones
					pendientes, búsquedas activas y programaciones) quepa en los límites de ese plan.
				</li>
				<li>
					Si un pago de renovación falla, la organización conserva el acceso durante 7 días. Después, queda en
					modo de solo lectura hasta que se actualice el método de pago. Sin un plan activo, los datos de la
					organización se conservan en modo de solo lectura.
				</li>
				<li>
					Los pilotos pueden usar códigos de descuento al pagar; se aplican los mismos términos.
				</li>
				<li>
					La cancelación y los reembolsos se rigen por la{" "}
					<Link href="/reembolsos">Política de reembolsos y cancelación</Link>.
				</li>
			</ul>

			<h2>6. Uso aceptable</h2>
			<p>Al usar Licitaly, usted se compromete a no:</p>
			<ul>
				<li>
					Extraer datos del servicio de forma automatizada (scraping), ni revender, sublicenciar o redistribuir
					el servicio o sus resultados como un producto propio.
				</li>
				<li>
					Abusar de las funciones de inteligencia artificial, por ejemplo intentando eludir sus instrucciones,
					usarlas para fines ajenos al servicio o generar contenido ilícito.
				</li>
				<li>
					Intentar acceder a datos de otras organizaciones, vulnerar la seguridad del servicio o sobrecargar su
					infraestructura.
				</li>
				<li>Compartir su cuenta con terceros o usar el servicio en contra de la ley.</li>
			</ul>

			<h2>7. Su contenido</h2>
			<p>
				Usted conserva la propiedad del contenido que ingresa: el perfil de su empresa, sus búsquedas, sus
				comentarios sobre las oportunidades y sus preguntas al chat. Nos otorga una licencia limitada para
				almacenarlo y procesarlo, incluso mediante proveedores de inteligencia artificial, con el único fin de
				prestarle el servicio. El tratamiento de los datos personales se describe en la{" "}
				<Link href="/privacidad">Política de privacidad</Link>.
			</p>

			<h2>8. Nuestra propiedad intelectual</h2>
			<p>
				El software, el diseño, la marca Licitaly y los análisis que genera el servicio, salvo los datos
				públicos de HonduCompras y su contenido, nos pertenecen. Estos términos le dan derecho a usar el servicio
				mientras tenga una cuenta, sin transferirle ningún otro derecho.
			</p>

			<h2>9. Disponibilidad</h2>
			<p>
				Procuramos que el servicio funcione de forma continua, pero no garantizamos un nivel de disponibilidad.
				La recolección de datos depende de que HonduCompras esté disponible y no cambie su funcionamiento; si el
				portal falla o cambia, los datos pueden retrasarse o quedar incompletos. Podemos interrumpir el servicio
				para mantenimiento o mejoras.
			</p>

			<h2>10. Limitación de responsabilidad</h2>
			<p>
				El servicio se ofrece «tal cual». En la medida que lo permita la ley, no somos responsables por daños
				indirectos, lucro cesante, pérdida de oportunidades de negocio ni por decisiones tomadas con base en los
				datos o en las respuestas del servicio. Nuestra responsabilidad total por cualquier reclamo relacionado
				con el servicio se limita a lo que su organización nos pagó en los 3 meses anteriores al hecho que lo
				origina.
			</p>

			<h2>11. Suspensión y terminación</h2>
			<p>
				Podemos suspender o cerrar una cuenta u organización que incumpla estos términos, que ponga en riesgo el
				servicio o a otros clientes, o cuando la ley lo exija. Cuando sea posible, se lo avisaremos antes por
				correo. Usted puede dejar de usar el servicio y cancelar su plan en cualquier momento.
			</p>

			<h2>12. Cambios en estos términos</h2>
			<p>
				Podemos actualizar estos términos. Si el cambio es importante, se lo avisaremos por correo electrónico o
				dentro de la aplicación antes de que entre en vigor. Si continúa usando el servicio después de esa fecha,
				acepta los términos actualizados.
			</p>

			<h2>13. Ley aplicable</h2>
			<p>
				Estos términos se rigen por las leyes de la República de Honduras. Cualquier controversia se someterá a
				los tribunales competentes de Honduras.
			</p>

			<h2>14. Contacto</h2>
			<p>
				Para cualquier consulta sobre estos términos, escríbanos a{" "}
				<a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
			</p>
		</LegalPage>
	);
}
