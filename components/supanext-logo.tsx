import * as React from "react";

const SupaNextLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
	<svg
		width="58"
		height="40"
		viewBox="0 0 58 40"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<path
			d="M34.6392 0L58 40H11.2785L34.6392 0Z"
			className="fill-foreground"
		/>
		<path
			d="M23.3608 0L46.7215 40H0L23.3608 0Z"
			className="fill-foreground/30"
		/>
	</svg>
);

export default React.memo(SupaNextLogo);
