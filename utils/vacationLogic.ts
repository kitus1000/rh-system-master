export const LFT_2023_RULE = [
    { years: 0, days: 0 },
    { years: 1, days: 12 },
    { years: 2, days: 14 },
    { years: 3, days: 16 },
    { years: 4, days: 18 },
    { years: 5, days: 20 },
    // From 6 to 10: 22
    // From 11 to 15: 24
    // etc.
];

export function calculateEntitlement(yearsOfService: number): number {
    if (yearsOfService < 1) return 0;
    if (yearsOfService <= 5) {
        return 10 + (2 * yearsOfService);
    }

    // For 6+ years:
    // 6-10 -> 22
    // 11-15 -> 24
    // Formula: 20 + 2 * floor((years - 1) / 5)
    // Let's test: 6 -> floor(5/5) = 1 -> 20 + 2(1) = 22. Correct.
    // 10 -> floor(9/5) = 1 -> 22. Correct.
    // 11 -> floor(10/5) = 2 -> 20 + 4 = 24. Correct.

    const group = Math.floor((yearsOfService - 1) / 5);
    return 20 + (2 * group);
}

export function calculateExpirationDate(anniversaryDate: Date): Date {
    // User requested: 1 year validity after rights are generated.
    // Rights are generated on the anniversary date.
    // So expiration is anniversaryDate + 1 year.
    const expiration = new Date(anniversaryDate);
    expiration.setFullYear(expiration.getFullYear() + 1);
    return expiration;
}

export function getServiceYears(hiringDateStr: string): { years: number, months: number, days: number, nextAnniversary: Date } {
    const start = new Date(hiringDateStr);
    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();

    if (months < 0 || (months === 0 && days < 0)) {
        years--;
        months += 12;
    }

    if (days < 0) {
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
        months--;
    }

    const nextAnniversary = new Date(start);
    nextAnniversary.setFullYear(now.getFullYear());
    if (nextAnniversary < now) {
        nextAnniversary.setFullYear(now.getFullYear() + 1);
    }

    return { years, months, days, nextAnniversary };
}
