export function env(key, fallback) {
    const val = process.env[key];
    if (val === undefined)
        return fallback;
    return val.replace(/^"(.*)"$/, '$1').trim();
}
