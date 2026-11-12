import type { CalendarProvider, ViewingSlot } from "./types.ts";

/** Stub calendar: always returns the agency's static booking link and no slots. */
export class StaticLinkCalendar implements CalendarProvider {
  constructor(private readonly link: string) {}

  bookingLink(_listingRef: string | null = null): string {
    return this.link;
  }

  async availableSlots(): Promise<ViewingSlot[]> {
    return [];
  }
}
