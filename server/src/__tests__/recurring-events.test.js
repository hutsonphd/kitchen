import ICAL from 'ical.js';

describe('Recurring Event Expansion', () => {
  test('should expand daily recurring events correctly', () => {
    // Create a daily recurring event iCal data
    const icalData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:daily-meeting@example.com
DTSTART:20251102T100000Z
DTEND:20251102T110000Z
RRULE:FREQ=DAILY;COUNT=5
SUMMARY:Daily Standup
DESCRIPTION:Team standup meeting
LOCATION:Conference Room A
END:VEVENT
END:VCALENDAR`;

    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    expect(vevents.length).toBe(1);

    const vevent = vevents[0];
    const event = new ICAL.Event(vevent);

    // Verify it's recognized as recurring
    expect(event.isRecurring()).toBe(true);

    // Expand the recurring event
    const startDate = ICAL.Time.fromJSDate(new Date('2025-11-02T00:00:00Z'), true);
    const endDate = ICAL.Time.fromJSDate(new Date('2025-11-08T23:59:59Z'), true);

    const expand = event.iterator(startDate);
    const occurrences = [];
    let next;

    while ((next = expand.next()) && occurrences.length < 10) {
      if (next.compare(endDate) > 0) break;
      occurrences.push(next.toJSDate());
    }

    // Should have 5 daily occurrences
    expect(occurrences.length).toBe(5);

    // Verify dates are consecutive days
    for (let i = 0; i < occurrences.length - 1; i++) {
      const diff = (occurrences[i + 1] - occurrences[i]) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(1);
    }
  });

  test('should expand weekly recurring events correctly', () => {
    // Create a weekly recurring event
    const icalData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:weekly-meeting@example.com
DTSTART:20251103T140000Z
DTEND:20251103T150000Z
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:Weekly Team Meeting
DESCRIPTION:Weekly sync meeting
LOCATION:Zoom
END:VEVENT
END:VCALENDAR`;

    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    const vevent = vevents[0];
    const event = new ICAL.Event(vevent);

    expect(event.isRecurring()).toBe(true);

    const startDate = ICAL.Time.fromJSDate(new Date('2025-11-01T00:00:00Z'), true);
    const endDate = ICAL.Time.fromJSDate(new Date('2025-12-01T23:59:59Z'), true);

    const expand = event.iterator(startDate);
    const occurrences = [];
    let next;

    while ((next = expand.next()) && occurrences.length < 10) {
      if (next.compare(endDate) > 0) break;
      occurrences.push(next.toJSDate());
    }

    // Should have 4 weekly occurrences
    expect(occurrences.length).toBe(4);

    // Verify dates are 7 days apart
    for (let i = 0; i < occurrences.length - 1; i++) {
      const diff = (occurrences[i + 1] - occurrences[i]) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(7);
    }
  });

  test('should not expand non-recurring events', () => {
    const icalData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:single-event@example.com
DTSTART:20251102T100000Z
DTEND:20251102T110000Z
SUMMARY:One-time Meeting
DESCRIPTION:Single occurrence
LOCATION:Office
END:VEVENT
END:VCALENDAR`;

    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    const vevent = vevents[0];
    const event = new ICAL.Event(vevent);

    // Verify it's NOT recurring
    expect(event.isRecurring()).toBe(false);

    // Should only have one occurrence
    expect(event.summary).toBe('One-time Meeting');
  });

  test('should handle recurring events with UNTIL clause', () => {
    const icalData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:until-event@example.com
DTSTART:20251102T100000Z
DTEND:20251102T110000Z
RRULE:FREQ=DAILY;UNTIL=20251105T235959Z
SUMMARY:Limited Daily Event
END:VEVENT
END:VCALENDAR`;

    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    const vevent = vevents[0];
    const event = new ICAL.Event(vevent);

    expect(event.isRecurring()).toBe(true);

    const startDate = ICAL.Time.fromJSDate(new Date('2025-11-02T00:00:00Z'), true);
    const endDate = ICAL.Time.fromJSDate(new Date('2025-11-10T23:59:59Z'), true);

    const expand = event.iterator(startDate);
    const occurrences = [];
    let next;

    while ((next = expand.next()) && occurrences.length < 20) {
      if (next.compare(endDate) > 0) break;
      occurrences.push(next.toJSDate());
    }

    // Should stop at Nov 5 (4 days: Nov 2, 3, 4, 5)
    expect(occurrences.length).toBe(4);
  });

  test('should respect safety limit for infinite recurring events', () => {
    const icalData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:infinite-event@example.com
DTSTART:20251102T100000Z
DTEND:20251102T110000Z
RRULE:FREQ=DAILY
SUMMARY:Infinite Daily Event
END:VEVENT
END:VCALENDAR`;

    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    const vevent = vevents[0];
    const event = new ICAL.Event(vevent);

    expect(event.isRecurring()).toBe(true);

    const startDate = ICAL.Time.fromJSDate(new Date('2025-11-02T00:00:00Z'), true);
    const expand = event.iterator(startDate);
    const occurrences = [];
    let next;
    const maxOccurrences = 1000;

    // Test that we respect the safety limit
    while ((next = expand.next()) && occurrences.length < maxOccurrences) {
      occurrences.push(next.toJSDate());
    }

    // Should stop at the safety limit
    expect(occurrences.length).toBe(maxOccurrences);
  });
});
