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
  note: "Choose a half-day morning session (9:00\u00a0a.m.\u201312:00\u00a0p.m.) or a whole-day program (8:00\u00a0a.m.\u20135:30\u00a0p.m., closing at 6\u00a0p.m.), 2 to 5 days per week.",

  // Monthly tuition table.
  columns: ["Days per week", "Half day (AM) \u00b7 monthly", "Whole day \u00b7 monthly"],
  rows: [
    ["5 days", "$1,100", "$2,050"],
    ["4 days", "$950",   "$1,850"],
    ["3 days", "$850",   "$1,650"],
    ["2 days", "$650",   "$1,250"]
  ],

  // Additional tuition tables shown below the preschool table.
  moreTables: [
    {
      heading: "Kindergarten & 1st Grade",
      columns: ["Program", "Tuition"],
      rows: [
        ["Whole Day (9am\u20133pm)", "$2,000/month"],
        ["Extended Care", "$2,150/month"]
      ]
    }
  ],

  // Registration and other fees. "label" is shown in bold.
  feesHeading: "Registration & other fees",
  fees: [
    {
      label: "Registration fee & deposit \u2014 $200 per child.",
      text: " A $100 non-refundable registration fee plus a $100 deposit that holds your child's spot and is applied toward the first month's tuition. Due when the Enrollment Application Form is signed. The deposit is refundable if enrollment is cancelled."
    },
    {
      label: "Material fee \u2014 $10 per month or $100 per school year.",
      text: " Covers textbooks and art supplies."
    },
    {
      label: "Extended care \u2014 $18 per hour",
      text: " (one-hour minimum, 5:30\u20136:00\u00a0p.m.) for registered students."
    },
    {
      label: "Optional lunch \u2014 $5.50 per lunch or $110 per month.",
      text: " A prepared lunch for children who'd prefer not to bring their own."
    },
    {
      label: "Late pickup \u2014 $50",
      text: " if a child is not picked up by 6:00\u00a0p.m."
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
