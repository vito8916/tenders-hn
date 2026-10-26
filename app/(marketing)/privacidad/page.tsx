import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/marketing/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
	title: "Política de privacidad",
	description:
		"Qué datos recopila Licitaly, para qué los usa, con qué proveedores los comparte y cómo puede acceder a ellos, corregirlos o eliminarlos.",
};

export default function PrivacyPage() {
	return (
		<LegalPage
			title="Política de privacidad"
			summary="Esta política explica qué datos recopilamos al prestarle el servicio, cómo los usamos y qué control tiene usted sobre ellos."
		>
			<h2>1. Responsable</h2>
			<p>
				El responsable de sus datos es {siteConfig.sellerName}, persona natural domiciliada en Honduras, que
				ofrece Licitaly. Para cualquier consulta sobre privacidad, escriba a{" "}
				<a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
			</p>

			<h2>2. Datos que recopilamos</h2>
			<ul>
				<li>
					<strong>Datos de su cuenta:</strong> nombre, correo electrónico y foto de perfil. Si inicia sesión con
					Google, recibimos de Google su nombre, correo y foto.
				</li>
				<li>
					<strong>Datos de la organización:</strong> nombre, logotipo, miembros, roles e invitaciones (incluido
					el correo de las personas invitadas).
				</li>
				<li>
					<strong>Perfil de la empresa y búsquedas:</strong> lo que su empresa vende, sus exclusiones,
					preferencias y búsquedas guardadas.
				</li>
				<li>
					<strong>El seguimiento de oportunidades:</strong> el estado que su equipo da a cada oportunidad, su
					responsable, las notas del equipo con su autor y fecha, y el motivo que indique al descartarla.
				</li>
				<li>
					<strong>Preguntas y respuestas del chat:</strong> cada conversación solo la ve la persona que la
					escribió; los demás miembros de la organización, incluidos los administradores, no tienen acceso.
				</li>
				<li>
					<strong>Uso y actividad:</strong> el registro de actividad de la organización, el consumo de créditos de
					IA y los avisos enviados.
				</li>
				<li>
					<strong>Datos técnicos:</strong> cookies necesarias para mantener su sesión iniciada y recordar el
					estado de algunos elementos de la interfaz. Su preferencia de tema (claro u oscuro) se guarda en el
					almacenamiento local de su navegador.
				</li>
			</ul>
			<p>
				Los datos de pago (tarjeta, dirección de facturación) los recopila y gestiona directamente{" "}
				{siteConfig.merchantOfRecord}; nosotros no vemos ni guardamos los números de su tarjeta.
			</p>
			<p>
				Los procesos de compra y sus documentos son información pública que obtenemos de HonduCompras, no datos
				que usted nos entregue.
			</p>

			<h2>3. Para qué los usamos</h2>
			<ul>
				<li>Crear y mantener su cuenta y su organización, y controlar quién accede a qué.</li>
				<li>Encontrar y priorizar oportunidades según el perfil de su empresa.</li>
				<li>Responder sus preguntas en el chat y analizar los documentos de los procesos.</li>
				<li>Enviarle invitaciones, reportes, avisos y mensajes sobre su cuenta y su plan.</li>
				<li>Aplicar los límites de su plan, prevenir abusos y mejorar el servicio.</li>
			</ul>
			<p>
				No vendemos sus datos personales ni los usamos para publicidad. El sitio no usa rastreadores de
				publicidad ni herramientas de analítica de terceros.
			</p>

			<h2>4. Proveedores que tratan datos por nosotros</h2>
			<p>
				Para prestar el servicio usamos los siguientes proveedores, que tratan datos solo para ese fin:
			</p>
			<ul>
				<li>
					<strong>Supabase:</strong> base de datos, autenticación y almacenamiento de archivos.
				</li>
				<li>
					<strong>Railway:</strong> alojamiento de la aplicación y de los procesos en segundo plano.
				</li>
				<li>
					<strong>Resend:</strong> envío de correos electrónicos.
				</li>
				<li>
					<strong>Vercel AI Gateway y los proveedores de modelos a los que dirige las solicitudes</strong>{" "}
					(actualmente OpenAI y Voyage AI): analizan los documentos de los procesos, comparan el perfil de su
					empresa y responden las preguntas del chat. Su contenido se les envía solo para prestarle el servicio.
				</li>
				<li>
					<strong>Google:</strong> solo si usted decide iniciar sesión con Google.
				</li>
				<li>
					<strong>{siteConfig.merchantOfRecord}:</strong> procesa los pagos, emite las facturas y gestiona los
					impuestos como comerciante registrado.
				</li>
			</ul>
			<p>
				Estos proveedores pueden almacenar o procesar datos fuera de Honduras. También podemos revelar datos
				cuando la ley lo exija.
			</p>

			<h2>5. Conservación</h2>
			<p>
				Conservamos sus datos mientras su cuenta u organización esté activa. Las notificaciones dentro de la
				aplicación se eliminan a los 180 días y el registro de envíos de correo, a los 90 días. Si su organización
				no tiene un plan activo, sus datos se conservan en modo de solo lectura.
			</p>
			<p>
				El propietario puede eliminar la organización desde su configuración, lo que borra sus datos. Para
				eliminar su cuenta personal, escríbanos a{" "}
				<a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>; la eliminaremos junto con
				sus datos, salvo los que debamos conservar por obligaciones legales o de facturación.
			</p>

			<h2>6. Sus derechos</h2>
			<p>
				Puede pedirnos acceso a sus datos, su corrección o su eliminación escribiendo a{" "}
				<a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>. Buena parte de sus datos
				(perfil, organización, perfil de la empresa y búsquedas) también puede verlos y corregirlos usted mismo
				en Configuración.
			</p>

			<h2>7. Seguridad</h2>
			<p>
				Los datos se transmiten cifrados y cada organización solo puede leer sus propios datos, mediante
				controles de acceso aplicados en la base de datos. Ningún sistema es infalible, pero trabajamos para
				proteger su información.
			</p>

			<h2>8. Cambios en esta política</h2>
			<p>
				Si cambiamos esta política de forma importante, se lo avisaremos por correo electrónico o dentro de la
				aplicación. Las condiciones de uso del servicio están en los{" "}
				<Link href="/terminos">Términos del servicio</Link>.
			</p>
		</LegalPage>
	);
}
