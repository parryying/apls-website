/* ============================================================
   ✏️  TUITION — EDIT THIS FILE ONCE A YEAR
   ------------------------------------------------------------
   This is the ONE place tuition is stored. Every page that
   shows tuition reads from here, so you only update it here.

   • Change a price? Edit the numbers below (keep the quotes).
   • Add/remove a row? Copy a line inside "rows" and edit it.
   • Add/remove a fee? Copy a { label, text } block in "fees".
   Save the file and refresh the page — done.
   ============================================================ */
window.APLS_TUITION = {
  heading: "Preschool monthly tuition",
  note: "Choose a half-day morning session (9:00\u00a0a.m.\u201312:00\u00a0p.m.) or a whole-day program (8:00\u00a0a.m.\u20136:00\u00a0p.m.), 2 to 5 days per week.",

  // Monthly tuition table.
  columns: ["Days per week", "Half day (AM) \u00b7 monthly", "Whole day \u00b7 monthly"],
  rows: [
    ["5 days", "$1,100", "$2,050"],
    ["4 days", "$950",   "$1,850"],
    ["3 days", "$850",   "$1,650"],
    ["2 days", "$650",   "$1,250"]
  ],

  // Registration and other fees. "label" is shown in bold.
  feesHeading: "Registration & other fees",
  fees: [
    {
      label: "Registration fee & deposit \u2014 $175 per child.",
      text: " A $75 non-refundable registration fee plus a $100 deposit that holds your child's spot and is applied toward the first month's tuition. Due when the Enrollment Application Form is signed. The deposit is refundable if enrollment is cancelled."
    },
    {
      label: "Annual material fee \u2014 $75 half-day / $100 whole-day.",
      text: " Covers textbooks and art supplies; the whole-day program also includes sleeping sheets."
    },
    {
      label: "Extra care \u2014 $15 per hour",
      text: " (one-hour minimum) for registered students."
    },
    {
      label: "Overtime \u2014 $35 per 30-minute interval",
      text: " if a child is not picked up by the scheduled time. This fee is billed with the next scheduled payment."
    },
    {
      label: "Non-potty-trained children.",
      text: " An additional fee applies, as we provide teaching assistants for toileting help. Parents supply pull-ups (no diapers), baby wipes, and plastic bags."
    },
    {
      label: "Sibling discount \u2014 10%",
      text: " for siblings of enrolled students."
    }
  ]
};
