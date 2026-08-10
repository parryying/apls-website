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
  note: "Choose a half-day morning session (9:00\u00a0a.m.\u201312:00\u00a0p.m.) or a whole-day program (8:00\u00a0a.m.\u20135:30\u00a0p.m.), 2 to 5 days per week. Extended care is available until 6:00\u00a0p.m.",

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
    },
    {
      heading: "After-School",
      note: "A $75 application fee applies for each new student. Siblings receive a 10% discount. No make-up classes or payment refunds. Before- and after-school care is $15/hour.",
      columns: ["Enrollment option", "Total tuition", "Monthly payment"],
      rows: [
        ["Monday & Wednesday", "$2,310 (42 classes)", "$462 (Jan.\u2013May)"],
        ["Wednesday only", "$1,210 (22 classes)", "$242 (Jan.\u2013May)"]
      ]
    },
    {
      heading: "Saturday School",
      note: "A $75 application fee applies for each new student. Siblings receive a 10% discount. No make-up classes or payment refunds. Before- and after-school care is $25/hour.",
      columns: ["Enrollment option", "Calculation", "Tuition"],
      rows: [
        ["Winter Quarter (Jan.\u2013Mar.)", "12 classes \u00d7 $55", "$660"],
        ["Spring Quarter (Apr.\u2013Jun.)", "10 classes \u00d7 $55", "$550"],
        ["Winter & Spring", "22 classes \u00d7 $55", "$1,210"]
      ]
    },
    {
      heading: "Summer Camp",
      note: "A $75 new-student application fee applies (waived for 2026 registrations completed before May 1). Early drop-off and late pick-up are available upon request for an additional charge. Siblings receive a 5% discount.",
      columns: ["Program", "Hours", "Tuition"],
      rows: [
        ["Half day", "9:00 a.m.\u201312:00 p.m.", "$325/week"],
        ["Full day", "9:00 a.m.\u20133:00 p.m.", "$500/week"]
      ]
    }
  ],

  // Compact tuition summaries rendered on individual program pages.
  // Use "main" for the preschool table or a zero-based moreTables index.
  programPages: {
    preschool: {
      table: "main",
      heading: "Preschool tuition",
      note: "Monthly tuition based on the number of days your child attends."
    },
    kindergarten: {
      table: 0,
      heading: "Kindergarten & 1st Grade tuition",
      note: "Monthly tuition for the whole-day program."
    },
    "after-school": {
      table: 1,
      heading: "After-School tuition",
      note: "2026 Winter and Spring rates are $55 per class. A $75 application fee applies for each new student. Siblings receive a 10% discount. No make-up classes or payment refunds. Before- and after-school care is $15/hour."
    },
    "saturday-school": {
      table: 2,
      heading: "Saturday School tuition",
      note: "2026 Winter and Spring rates for Saturday School. A $75 application fee applies for each new student. Siblings receive a 10% discount. No make-up classes or payment refunds. Before- and after-school care is $25/hour."
    },
    "summer-camp": {
      table: 3,
      heading: "Summer Camp tuition",
      note: "Weekly 2026 tuition. A $75 new-student application fee applies (waived for registrations completed before May 1). Early drop-off and late pick-up are available upon request for an additional charge. Siblings receive a 5% discount."
    },
    "ap-prep": {
      heading: "AP Prep tuition",
      note: "Rates vary by course format and term. Contact APLS for the current class rate."
    }
  },

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
