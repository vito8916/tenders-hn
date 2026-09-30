/** Paddle amounts are strings in the currency's lowest unit (cents for USD). */
export function formatMoney(amount: string, currencyCode: string) {
    return new Intl.NumberFormat("es-HN", { style: "currency", currency: currencyCode, currencyDisplay: "narrowSymbol" }).format(Number(amount) / 100);
}
