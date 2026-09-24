import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const questions = [
	{
		question: "¿Reemplaza leer las bases oficiales?",
		answer:
			"No. Le ayudamos a descubrir y priorizar oportunidades, pero no certificamos que su empresa cumpla los requisitos para ofertar. Cada resultado enlaza a la publicación oficial para que la revise.",
	},
	{
		question: "¿De dónde salen los procesos?",
		answer:
			"De HonduCompras. Consultamos el portal de forma central, recorremos todas las páginas de resultados y guardamos el detalle y los documentos de cada proceso. Su búsqueda no limita lo que capturamos.",
	},
	{
		question: "¿Cada cuánto se actualizan los datos?",
		answer:
			"Durante el piloto consultamos HonduCompras varias veces al día y medimos cuánto tarda en aparecer cada proceso. No prometemos tiempo real: cada reporte muestra cuándo se consultó la fuente por última vez.",
	},
	{
		question: "¿Qué pasa si un proceso no tiene documentos?",
		answer:
			"Es un caso normal. Lo evaluamos con la información del detalle y le indicamos que no había archivos. Si un PDF no se puede leer, el análisis se marca como parcial.",
	},
	{
		question: "¿Para qué sirven los créditos de IA?",
		answer:
			"Para las preguntas al chat y los análisis extensos que usted pida. El matching y los reportes básicos no consumen créditos. Antes de usarlos verá el saldo disponible.",
	},
	{
		question: "¿Puede usarlo todo mi equipo?",
		answer:
			"Sí. Su empresa es una organización con un administrador y miembros que comparten las búsquedas y los reportes. La cantidad de miembros depende del plan.",
	},
];

export default function FaqSection() {
	return (
		<section id="preguntas" className="scroll-mt-14 border-t bg-muted/30 py-20 md:py-28">
			<div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
				<div className="flex flex-col gap-3">
					<p className="font-mono text-xs font-medium tracking-wider text-accent-blue uppercase">
						Preguntas frecuentes
					</p>
					<h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
						Lo que suelen preguntarnos
					</h2>
				</div>

				<Accordion type="single" collapsible className="rounded-2xl bg-background px-5 shadow-edge">
					{questions.map((item) => (
						<AccordionItem key={item.question} value={item.question}>
							<AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
							<AccordionContent className="text-pretty text-muted-foreground">{item.answer}</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</section>
	);
}
