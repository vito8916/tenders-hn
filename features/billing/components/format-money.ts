/** Paddle amounts are strings in the currency's lowest unit (cents for USD). */
export function formatMoney(amount: string, currencyCode: string) {
    const formatted = new Intl.NumberFormat("es-HN", {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        trailingZeroDisplay: "stripIfInteger",
    }).format(Number(amount) / 100);
    return currencyCode === "USD" ? `US${formatted}` : formatted;
}
