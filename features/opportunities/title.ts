const WRAPPING_QUOTES = /^["“”«»]+\s*([\s\S]*?)\s*["“”«»]+[.,;:]*$/;
const PARENTHESIZED_ACRONYM = /^\(\p{Lu}{2,6}\)[.,;:]*$/u;
const UPPERCASE_SHARE_FOR_SENTENCE_CASE = 0.7;
const SPANISH_VOWELS = /[AEIOUÁÉÍÓÚÜ]/u;
const KNOWN_ACRONYMS = new Set([
    "AMDC", "BCIE", "BID", "COPECO", "ENEE", "ENP", "GTIC", "HMEP", "HONDUTEL", "IDECOAS", "IHSS", "INSEP", "IPM",
    "LPN", "LPI", "ONCAE", "PSI", "SANAA", "SAP", "SEDUC", "SESAL", "SIT", "TI", "UNAH", "II", "III", "IV", "VI", "VII", "VIII",
]);

function isAcronym(token: string) {
    const word = token.replace(/[^\p{L}]/gu, "");
    if (word.length < 2 || word !== word.toLocaleUpperCase("es")) return false;
    return !SPANISH_VOWELS.test(word) || KNOWN_ACRONYMS.has(word);
}

function isMostlyUppercase(text: string) {
    const letters = text.match(/\p{L}/gu) ?? [];
    if (letters.length === 0) return false;
    const uppercase = letters.filter((letter) => letter === letter.toLocaleUpperCase("es") && letter !== letter.toLocaleLowerCase("es"));
    return uppercase.length / letters.length >= UPPERCASE_SHARE_FOR_SENTENCE_CASE;
}

function lowercaseToken(token: string) {
    if (/\d/.test(token) || PARENTHESIZED_ACRONYM.test(token) || isAcronym(token)) return token;
    const parts = token.split("-");
    if (parts.length < 3) return token.toLocaleLowerCase("es");
    return parts.map((part, index) => (index < parts.length - 1 ? part : part.toLocaleLowerCase("es"))).join("-");
}

/**
 * How a process title reads in the app: HonduCompras publishes them wrapped in
 * quotes and often in capitals. Display only; the stored title is untouched.
 */
export function formatOpportunityTitle(title: string) {
    const trimmed = title.trim();
    const unquoted = trimmed.match(WRAPPING_QUOTES)?.[1] ?? trimmed;
    if (!isMostlyUppercase(unquoted)) return unquoted;
    const lowered = unquoted.split(/(\s+)/).map(lowercaseToken).join("");
    return lowered.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("es"));
}
