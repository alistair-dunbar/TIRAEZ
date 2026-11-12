// Calendar interface. v0 just hands out the booking link from the config;
// a Google/Outlook calendar implementation can offer real slots later.

export interface ViewingSlot {
  start: Date;
  end: Date;
  listingRef: string;
}

export interface CalendarProvider {
  /** Link the buyer can use to book a viewing. */
  bookingLink(listingRef: string | null): string;
  /** Free viewing slots. Not used by v0. */
  availableSlots(listingRef: string, from: Date, to: Date): Promise<ViewingSlot[]>;
}
