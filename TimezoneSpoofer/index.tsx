/*
 * Vencord, a Discord client mod
 * 
 * Spoofs your timezone in the Discord app.
 */
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { filters, waitFor, cache } from "@webpack";
import { DateUtils, moment } from "@webpack/common";

const settings = definePluginSettings({
    timezone: {
        type: OptionType.SELECT,
        description: "Select the timezone to spoof",
        restartNeeded: true,
        options: [
            { label: "UTC (Greenwich Mean Time)", value: "UTC" },
            { label: "Honolulu (HST, UTC-10)", value: "Pacific/Honolulu" },
            { label: "Los Angeles (PST/PDT, UTC-8/UTC-7)", value: "America/Los_Angeles" },
            { label: "Denver (MST/MDT, UTC-7/UTC-6)", value: "America/Denver" },
            { label: "Chicago (CST/CDT, UTC-6/UTC-5)", value: "America/Chicago" },
            { label: "New York (EST/EDT, UTC-5/UTC-4)", value: "America/New_York" },
            { label: "London (GMT/BST, UTC+0/UTC+1)", value: "Europe/London" },
            { label: "Paris (CET/CEST, UTC+1/UTC+2)", value: "Europe/Paris" },
            { label: "Moscow (MSK, UTC+3)", value: "Europe/Moscow" },
            { label: "Dubai (GST, UTC+4)", value: "Asia/Dubai" },
            { label: "Mumbai (IST, UTC+5.5)", value: "Asia/Kolkata" },
            { label: "Singapore (SGT, UTC+8)", value: "Asia/Singapore" },
            { label: "Tokyo (JST, UTC+9)", value: "Asia/Tokyo", default: true },
            { label: "Seoul (KST, UTC+9)", value: "Asia/Seoul" },
            { label: "Sydney (AEST/AEDT, UTC+10/UTC+11)", value: "Australia/Sydney" },
            { label: "Auckland (NZST/NZDT, UTC+12/UTC+13)", value: "Pacific/Auckland" }
        ]
    }
});

function getTargetTimeZone(): string {
    return settings.store.timezone ?? "Asia/Tokyo";
}

let originalCalendarFormat: any = null;
let originalDateFormat: any = null;
let originalIsSameDay: any = null;

let originalMomentLocal: any = null;
let originalMomentFormat: any = null;
let originalMomentCalendar: any = null;

let DateUtilsRef: any = null;
let DateUtilsKeys: { calendarFormatKey: string | null; dateFormatKey: string | null; isSameDayKey: string | null; } = {
    calendarFormatKey: null,
    dateFormatKey: null,
    isSameDayKey: null
};

let MomentRef: any = null;

let isIntercepting = false;
let isFormatting = false;

// Safe patch helper for object properties
function safePatch(obj: any, key: string, patchFn: (orig: any) => any): any {
    if (!obj) return null;
    const original = obj[key];
    try {
        Object.defineProperty(obj, key, {
            value: patchFn(original),
            writable: true,
            configurable: true
        });
    } catch (e) {
        obj[key] = patchFn(original);
    }
    return original;
}

// Helper to restore properties
function restoreProp(obj: any, key: string, original: any) {
    if (!obj || !original) return;
    try {
        Object.defineProperty(obj, key, {
            value: original,
            writable: true,
            configurable: true
        });
    } catch (e) {
        obj[key] = original;
    }
}

// Helper to calculate timezone offset in minutes for a specific date in a specific timezone
function getTzOffset(date: Date, timeZone: string): number {
    try {
        if (!date || isNaN(date.getTime())) return 540; // Default Tokyo (UTC+9)

        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: false
        });
        const parts = formatter.formatToParts(date);
        const map: Record<string, string> = {};
        for (const p of parts) {
            map[p.type] = p.value;
        }
        
        let hour = parseInt(map.hour);
        if (hour === 24) hour = 0;
        
        const tzTime = Date.UTC(
            parseInt(map.year),
            parseInt(map.month) - 1,
            parseInt(map.day),
            hour,
            parseInt(map.minute),
            parseInt(map.second)
        );
        const utcTime = Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds()
        );
        return Math.round((tzTime - utcTime) / 60000);
    } catch (e) {
        console.error("[TimezoneSpoofer] Error calculating timezone offset:", e);
        return 540; // Default Tokyo (UTC+9)
    }
}

// Helper to shift Date or Moment to local representation of target timezone
function getShiftedDate(originalDate: any, targetTimeZone: string): any {
    try {
        if (!originalDate) return originalDate;
        
        let dateObj: Date;
        let isMoment = false;
        
        if (originalDate instanceof Date) {
            dateObj = originalDate;
        } else if (MomentRef && MomentRef.isMoment && MomentRef.isMoment(originalDate)) {
            dateObj = originalDate.toDate();
            isMoment = true;
        } else if (originalDate._isAMomentObject || (typeof originalDate === "object" && typeof originalDate.toDate === "function")) {
            dateObj = originalDate.toDate();
            isMoment = true;
        } else if (typeof originalDate === "number") {
            dateObj = new Date(originalDate);
        } else if (typeof originalDate === "string") {
            dateObj = new Date(originalDate);
        } else {
            return originalDate;
        }

        if (isNaN(dateObj.getTime())) return originalDate;
        
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: targetTimeZone,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: false
        });
        
        const parts = formatter.formatToParts(dateObj);
        const map: Record<string, string> = {};
        for (const p of parts) {
            map[p.type] = p.value;
        }
        
        let hour = parseInt(map.hour);
        if (hour === 24) hour = 0;
        
        const shiftedDate = new Date(
            parseInt(map.year),
            parseInt(map.month) - 1,
            parseInt(map.day),
            hour,
            parseInt(map.minute),
            parseInt(map.second),
            dateObj.getMilliseconds()
        );
        
        if (isMoment && MomentRef) {
            return MomentRef(shiftedDate);
        }
        
        if (typeof originalDate === "number") {
            return shiftedDate.getTime();
        }
        
        return shiftedDate;
    } catch (e) {
        console.error("[TimezoneSpoofer] Error shifting date:", e);
        return originalDate;
    }
}

// Original descriptors and properties
let OriginalDate = globalThis.Date;
let isDatePatched = false;

let originalFormatDescriptor: any = null;
let originalFormatToParts: any = null;
let originalToLocaleString: any = null;
let originalToLocaleTimeString: any = null;
let originalToLocaleDateString: any = null;
let originalGetTimezoneOffset: any = null;
let originalToString: any = null;
let originalToTimeString: any = null;

const getters = [
    "getFullYear", "getMonth", "getDate", "getDay", 
    "getHours", "getMinutes", "getSeconds", "getMilliseconds"
] as const;

const originalGetters = {} as Record<string, any>;

export default definePlugin({
    name: "TimezoneSpoofer",
    description: "Spoof your timezone in Discord.",
    authors: [{ name: "lain", id: 939658593026867261n }],
    settings,
    start() {
        console.log("[TimezoneSpoofer] Plugin starting and setting up hooks...");

        // 1. Global Date constructor and Date.now patches (active only during formatting)
        try {
            const PatchedDate = function(this: any, ...args: any[]) {
                if (args.length === 0 && isFormatting && !isIntercepting) {
                    isIntercepting = true;
                    try {
                        const shifted = getShiftedDate(new OriginalDate(), getTargetTimeZone());
                        if (new.target) {
                            return shifted;
                        }
                        return shifted.toString();
                    } finally {
                        isIntercepting = false;
                    }
                }
                if (new.target) {
                    return Reflect.construct(OriginalDate, args, new.target);
                }
                return (OriginalDate as any)(...args);
            };
            PatchedDate.prototype = OriginalDate.prototype;
            PatchedDate.now = () => {
                if (isFormatting && !isIntercepting) {
                    isIntercepting = true;
                    try {
                        return getShiftedDate(new OriginalDate(), getTargetTimeZone()).getTime();
                    } finally {
                        isIntercepting = false;
                    }
                }
                return OriginalDate.now();
            };
            PatchedDate.UTC = OriginalDate.UTC;
            PatchedDate.parse = OriginalDate.parse;
            
            globalThis.Date = PatchedDate as any;
            isDatePatched = true;
            console.log("[TimezoneSpoofer] Global Date constructor and Date.now patched.");
        } catch (e) {
            console.error("[TimezoneSpoofer] Failed to patch Date constructor:", e);
        }

        // 2. Global Date.prototype getter patches (with recursion guard)
        try {
            getters.forEach(getter => {
                originalGetters[getter] = Date.prototype[getter];
                (Date.prototype as any)[getter] = function(this: Date) {
                    if (isIntercepting) {
                        return originalGetters[getter].call(this);
                    }
                    isIntercepting = true;
                    try {
                        const shifted = getShiftedDate(this, getTargetTimeZone());
                        return originalGetters[getter].call(shifted);
                    } finally {
                        isIntercepting = false;
                    }
                };
            });

            originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
            Date.prototype.getTimezoneOffset = function(this: Date) {
                if (isIntercepting) {
                    return originalGetTimezoneOffset.call(this);
                }
                isIntercepting = true;
                try {
                    return -getTzOffset(this, getTargetTimeZone());
                } finally {
                    isIntercepting = false;
                }
            };

            originalToString = Date.prototype.toString;
            Date.prototype.toString = function(this: Date) {
                if (isIntercepting) {
                    return originalToString.call(this);
                }
                isIntercepting = true;
                try {
                    const shifted = getShiftedDate(this, getTargetTimeZone());
                    return originalToString.call(shifted).replace(/GMT.*/, "(Spoofed Timezone)");
                } finally {
                    isIntercepting = false;
                }
            };

            originalToTimeString = Date.prototype.toTimeString;
            Date.prototype.toTimeString = function(this: Date) {
                if (isIntercepting) {
                    return originalToTimeString.call(this);
                }
                isIntercepting = true;
                try {
                    const shifted = getShiftedDate(this, getTargetTimeZone());
                    return originalToTimeString.call(shifted).replace(/GMT.*/, "(Spoofed Timezone)");
                } finally {
                    isIntercepting = false;
                }
            };

            console.log("[TimezoneSpoofer] Safe global Date prototype getters patched.");
        } catch (e) {
            console.error("[TimezoneSpoofer] Failed to patch Date prototype getters:", e);
        }

        // 3. Global Intl.DateTimeFormat.prototype patches
        try {
            const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            originalFormatDescriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format");
            if (originalFormatDescriptor && originalFormatDescriptor.get) {
                const originalGet = originalFormatDescriptor.get;
                Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
                    ...originalFormatDescriptor,
                    get() {
                        const originalFormatterFunc = originalGet.call(this);
                        const formatterTz = this.resolvedOptions().timeZone;
                        
                        return function(this: any, date?: Date | number) {
                            const wasFormatting = isFormatting;
                            isFormatting = true;
                            try {
                                if (date && !isIntercepting && formatterTz === systemTz) {
                                    isIntercepting = true;
                                    try {
                                        const shifted = getShiftedDate(date, getTargetTimeZone());
                                        return originalFormatterFunc.call(this, shifted);
                                    } finally {
                                        isIntercepting = false;
                                    }
                                }
                                return originalFormatterFunc.call(this, date);
                            } finally {
                                isFormatting = wasFormatting;
                            }
                        };
                    }
                });
            }

            originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
            Intl.DateTimeFormat.prototype.formatToParts = function(this: any, date?: Date | number) {
                const wasFormatting = isFormatting;
                isFormatting = true;
                try {
                    const formatterTz = this.resolvedOptions().timeZone;
                    if (date && !isIntercepting && formatterTz === systemTz) {
                        isIntercepting = true;
                        try {
                            const shifted = getShiftedDate(date, getTargetTimeZone());
                            return originalFormatToParts.call(this, shifted);
                        } finally {
                            isIntercepting = false;
                        }
                    }
                    return originalFormatToParts.call(this, date);
                } finally {
                    isFormatting = wasFormatting;
                }
            };

            originalToLocaleString = Date.prototype.toLocaleString;
            Date.prototype.toLocaleString = function(this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
                const wasFormatting = isFormatting;
                isFormatting = true;
                try {
                    if (!isIntercepting && (!options || !options.timeZone)) {
                        isIntercepting = true;
                        try {
                            const shifted = getShiftedDate(this, getTargetTimeZone());
                            return originalToLocaleString.call(shifted, locales, options);
                        } finally {
                            isIntercepting = false;
                        }
                    }
                    return originalToLocaleString.call(this, locales, options);
                } finally {
                    isFormatting = wasFormatting;
                }
            };

            originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
            Date.prototype.toLocaleTimeString = function(this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
                const wasFormatting = isFormatting;
                isFormatting = true;
                try {
                    if (!isIntercepting && (!options || !options.timeZone)) {
                        isIntercepting = true;
                        try {
                            const shifted = getShiftedDate(this, getTargetTimeZone());
                            return originalToLocaleTimeString.call(shifted, locales, options);
                        } finally {
                            isIntercepting = false;
                        }
                    }
                    return originalToLocaleTimeString.call(this, locales, options);
                } finally {
                    isFormatting = wasFormatting;
                }
            };

            originalToLocaleDateString = Date.prototype.toLocaleDateString;
            Date.prototype.toLocaleDateString = function(this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
                const wasFormatting = isFormatting;
                isFormatting = true;
                try {
                    if (!isIntercepting && (!options || !options.timeZone)) {
                        isIntercepting = true;
                        try {
                            const shifted = getShiftedDate(this, getTargetTimeZone());
                            return originalToLocaleDateString.call(shifted, locales, options);
                        } finally {
                            isIntercepting = false;
                        }
                    }
                    return originalToLocaleDateString.call(this, locales, options);
                } finally {
                    isFormatting = wasFormatting;
                }
            };

            console.log("[TimezoneSpoofer] Global Intl and Date prototype formatters patched.");
        } catch (e) {
            console.error("[TimezoneSpoofer] Failed to apply global Intl prototype patches:", e);
        }

        // 4. Webpack DateUtils patches (Resolving mangled keys at runtime)
        waitFor(filters.byCode("millisecondsInUnit:"), (matchedFn: any, moduleId: any) => {
            const rawDateUtilsModule = cache[moduleId]?.exports;
            console.log("[TimezoneSpoofer] DateUtils module loaded:", rawDateUtilsModule);
            if (!rawDateUtilsModule) {
                console.error("[TimezoneSpoofer] Failed to resolve raw DateUtils module exports from cache.");
                return;
            }
            DateUtilsRef = rawDateUtilsModule;

            // Find mangled keys using Vencord's own filters
            let calendarFormatKey: string | null = null;
            let dateFormatKey: string | null = null;
            let isSameDayKey: string | null = null;

            const isCalendarFormat = filters.byCode('<-1?"sameElse":');
            const isDateFormat = filters.byCode('<2?"nextDay":"sameElse";');
            const isSameDay = filters.byCode(/Math\.abs\(\i-\i\)/);

            const checkObject = (obj: any) => {
                for (const key in obj) {
                    try {
                        const val = obj[key];
                        if (isCalendarFormat(val)) {
                            calendarFormatKey = key;
                        }
                        if (isDateFormat(val)) {
                            dateFormatKey = key;
                        }
                        if (isSameDay(val)) {
                            isSameDayKey = key;
                        }
                    } catch (e) {}
                }
            };

            checkObject(rawDateUtilsModule);
            if (rawDateUtilsModule.prototype) {
                checkObject(rawDateUtilsModule.prototype);
            }

            console.log("[TimezoneSpoofer] Resolved mangled keys:", { calendarFormatKey, dateFormatKey, isSameDayKey });

            DateUtilsKeys = { calendarFormatKey, dateFormatKey, isSameDayKey };

            if (calendarFormatKey) {
                originalCalendarFormat = safePatch(rawDateUtilsModule, calendarFormatKey, (orig: any) => function(this: any, date: any, referenceTime?: any, ...args: any[]) {
                    const wasFormatting = isFormatting;
                    isFormatting = true;
                    try {
                        const tTz = getTargetTimeZone();
                        const shiftedDate = getShiftedDate(date, tTz);
                        const shiftedRef = referenceTime !== undefined 
                            ? getShiftedDate(referenceTime, tTz) 
                            : undefined;
                        return orig.call(this, shiftedDate, shiftedRef, ...args);
                    } finally {
                        isFormatting = wasFormatting;
                    }
                });
            }
            if (dateFormatKey) {
                originalDateFormat = safePatch(rawDateUtilsModule, dateFormatKey, (orig: any) => function(this: any, date: any, format: any) {
                    const wasFormatting = isFormatting;
                    isFormatting = true;
                    try {
                        return orig.call(this, getShiftedDate(date, getTargetTimeZone()), format);
                    } finally {
                        isFormatting = wasFormatting;
                    }
                });
            }
            if (isSameDayKey) {
                originalIsSameDay = safePatch(rawDateUtilsModule, isSameDayKey, (orig: any) => function(this: any, date1: any, date2: any) {
                    const wasFormatting = isFormatting;
                    isFormatting = true;
                    try {
                        const tTz = getTargetTimeZone();
                        return orig.call(this, getShiftedDate(date1, tTz), getShiftedDate(date2, tTz));
                    } finally {
                        isFormatting = wasFormatting;
                    }
                });
            }

            console.log("[TimezoneSpoofer] Raw DateUtils hooks applied successfully.");
        });

        // 5. Webpack moment patches
        waitFor(["parseTwoDigitYear"], (momentModule: any) => {
            console.log("[TimezoneSpoofer] moment resolved:", momentModule);
            MomentRef = momentModule;
            if (momentModule && momentModule.fn) {
                originalMomentLocal = safePatch(momentModule.fn, "local", (orig: any) => function(this: any) {
                    const wasFormatting = isFormatting;
                    isFormatting = true;
                    try {
                        const tTz = getTargetTimeZone();
                        const tzOffset = getTzOffset(this.toDate(), tTz);
                        return this.utcOffset(tzOffset);
                    } finally {
                        isFormatting = wasFormatting;
                    }
                });

                originalMomentFormat = safePatch(momentModule.fn, "format", (orig: any) => function(this: any, formatStr?: string) {
                    const wasFormatting = isFormatting;
                    isFormatting = true;
                    try {
                        const tTz = getTargetTimeZone();
                        const tzOffset = getTzOffset(this.toDate(), tTz);
                        const cloned = this.clone().utcOffset(tzOffset);
                        return orig.call(cloned, formatStr);
                    } finally {
                        isFormatting = wasFormatting;
                    }
                });

                originalMomentCalendar = safePatch(momentModule.fn, "calendar", (orig: any) => function(this: any, referenceTime?: any, formats?: any) {
                    const wasFormatting = isFormatting;
                    isFormatting = true;
                    try {
                        const tTz = getTargetTimeZone();
                        const tzOffset = getTzOffset(this.toDate(), tTz);
                        const cloned = this.clone().utcOffset(tzOffset);
                        const ref = referenceTime 
                            ? (MomentRef && MomentRef.isMoment && MomentRef.isMoment(referenceTime) 
                                ? referenceTime.clone().utcOffset(tzOffset) 
                                : getShiftedDate(referenceTime, tTz))
                            : (MomentRef ? MomentRef().utcOffset(tzOffset) : new Date());
                        return orig.call(cloned, ref, formats);
                    } finally {
                        isFormatting = wasFormatting;
                    }
                });
                console.log("[TimezoneSpoofer] moment hooks applied successfully.");
            }
        });
    },
    stop() {
        console.log("[TimezoneSpoofer] Plugin stopping and removing hooks...");
        
        // Restore Date constructor
        if (isDatePatched) {
            globalThis.Date = OriginalDate;
        }

        // Restore Date getters
        getters.forEach(getter => {
            if (originalGetters[getter]) Date.prototype[getter] = originalGetters[getter];
        });
        if (originalGetTimezoneOffset) Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
        if (originalToString) Date.prototype.toString = originalToString;
        if (originalToTimeString) Date.prototype.toTimeString = originalToTimeString;

        // Restore Intl prototypes
        if (originalFormatDescriptor) {
            Object.defineProperty(Intl.DateTimeFormat.prototype, "format", originalFormatDescriptor);
        }
        if (originalFormatToParts) {
            Intl.DateTimeFormat.prototype.formatToParts = originalFormatToParts;
        }
        if (originalToLocaleString) Date.prototype.toLocaleString = originalToLocaleString;
        if (originalToLocaleTimeString) Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
        if (originalToLocaleDateString) Date.prototype.toLocaleDateString = originalToLocaleDateString;

        // Restore DateUtils raw keys
        if (DateUtilsRef) {
            if (DateUtilsKeys.calendarFormatKey && originalCalendarFormat) {
                restoreProp(DateUtilsRef, DateUtilsKeys.calendarFormatKey, originalCalendarFormat);
            }
            if (DateUtilsKeys.dateFormatKey && originalDateFormat) {
                restoreProp(DateUtilsRef, DateUtilsKeys.dateFormatKey, originalDateFormat);
            }
            if (DateUtilsKeys.isSameDayKey && originalIsSameDay) {
                restoreProp(DateUtilsRef, DateUtilsKeys.isSameDayKey, originalIsSameDay);
            }
        }

        // Restore moment
        if (MomentRef && MomentRef.fn) {
            restoreProp(MomentRef.fn, "local", originalMomentLocal);
            restoreProp(MomentRef.fn, "format", originalMomentFormat);
            restoreProp(MomentRef.fn, "calendar", originalMomentCalendar);
        }
        console.log("[TimezoneSpoofer] Hooks removed.");
    }
});
