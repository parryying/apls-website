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
  note: "Choose a half-day morning session (9:00\u00a0a.m.\u201312:00\u00a0p.m.) or a full-day program (8:00\u00a0a.m.\u20135:30\u00a0p.m.), 2 to 5 days per week. Extended care is available until 6:00\u00a0p.m.",

  // Monthly tuition table.
  columns: ["Days per week", "Half day (AM)", "Full day (8am\u20135:30pm)"],
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
        ["Full Day (9am\u20133pm)", "$2,000/month"],
        ["Full Day + Extended Care (8am\u20135:30pm)", "$2,150/month"]
      ]
    },
    {
      heading: "After-School",
      note: "Fall 2026 tuition is $55 per class. Classes are enrolled by the quarter \u2014 single classes are not sold separately. A $100 application fee applies for each new student. No make-up classes or payment refunds. Before- and after-school care is $18/hour. We offer pick-up from local elementary schools for $25 per student, per trip.",
      columns: ["Enrollment option", "Total tuition", "Monthly payment"],
      rows: [
        ["Monday & Wednesday", "$1,485 (27 classes)", "$450 (Sept.\u2013Nov.), $135 (Dec.)"],
        ["Wednesday only", "$770 (14 classes)", "$220 (Sept.\u2013Nov.), $110 (Dec.)"]
      ]
    },
    {
      heading: "Summer Camp",
      note: "A $100 new-student application fee applies (waived for 2026 registrations completed before May 1).",
      columns: ["Program", "Hours", "Tuition"],
      rows: [
        ["Half day", "9:00 a.m.\u201312:00 p.m.", "$325/week"],
        ["Full day", "9:00 a.m.\u20133:00 p.m.", "$500/week"],
        ["Full day + extended care", "8:00 a.m.\u20135:30 p.m.", "$600/week"]
      ]
    },
    {
      heading: "Saturday School",
      note: "Fall 2026 tuition is $55 per class. Classes are enrolled by the quarter \u2014 single classes are not sold separately. A $100 application fee applies for each new student. No make-up classes or payment refunds. No extended care is offered. A $50 late-pickup fee applies.",
      columns: ["Enrollment option", "Total tuition", "Monthly payment"],
      rows: [
        ["Fall Quarter (Sept.\u2013Dec.)", "$715 (13 classes)", "$220 (Sept.\u2013Nov.), $55 (Dec.)"]
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
      note: "Monthly tuition for the full-day program."
    },
    "after-school": {
      table: 1,
      heading: "After-School tuition",
      note: "Fall 2026 tuition is $55 per class. Classes are enrolled by the quarter \u2014 single classes are not sold separately. A $100 application fee applies for each new student. Siblings receive a 10% discount. No make-up classes or payment refunds. Before- and after-school care is $18/hour. We offer pick-up from local elementary schools for $25 per student, per trip."
    },
    "saturday-school": {
      table: 3,
      heading: "Saturday School tuition",
      note: "Fall 2026 tuition is $55 per class. Classes are enrolled by the quarter \u2014 single classes are not sold separately. A $100 application fee applies for each new student. Siblings receive a 10% discount. No make-up classes or payment refunds. No extended care is offered. A $50 late-pickup fee applies."
    },
    "summer-camp": {
      table: 2,
      heading: "Summer Camp tuition",
      note: "Weekly 2026 tuition. A $100 new-student application fee applies (waived for registrations completed before May 1). Siblings receive a 5% discount."
    },
    "ap-prep": {
      heading: "AP Prep tuition"
    }
  },

  // Registration and other fees. "label" is shown in bold.
  // "appliesTo" lists which program pages show the fee (tuition.html always shows all).
  feesHeading: "Registration & other fees",
  fees: [
    {
      appliesTo: ["preschool", "kindergarten"],
      label: "Registration fee & deposit \u2014 $200 per child (Preschool and Kindergarten & 1st Grade only).",
      text: " A $100 non-refundable registration fee plus a $100 deposit that holds your child's spot and is applied toward the first month's tuition. Due when the Enrollment Application Form is signed. The deposit is refundable if enrollment is cancelled. After-School, Saturday School, and Summer Camp have no deposit \u2014 they pay only the application fee listed with each program on the Tuition page."
    },
    {
      appliesTo: ["preschool", "kindergarten"],
      label: "Material fee \u2014 $10 per month or $100 per school year (Preschool and Kindergarten & 1st Grade only).",
      text: " Covers textbooks and art supplies."
    },
    {
      appliesTo: ["preschool", "kindergarten", "after-school", "summer-camp"],
      label: "Extended care after 5:30\u00a0p.m. \u2014 $18 per hour",
      text: " (one-hour minimum, until 6:00\u00a0p.m.) for registered students. Available in every program except Saturday School, which offers no extended care."
    },
    {
      appliesTo: ["preschool", "kindergarten", "summer-camp"],
      label: "Optional lunch \u2014 $5.50 per lunch or $110 per month.",
      text: " A prepared lunch for children who'd prefer not to bring their own \u2014 available to Preschool, Kindergarten & 1st Grade, and Summer Camp students."
    },
    {
      appliesTo: ["preschool", "kindergarten", "after-school", "saturday-school", "summer-camp"],
      label: "Late pickup \u2014 $50",
      text: " if a child is not picked up by 6:00\u00a0p.m. For Saturday School, the fee applies after the end of class."
    },
    {
      appliesTo: ["preschool"],
      label: "Non-potty-trained children.",
      text: " No additional fee applies. We provide teaching assistants for toileting help. Parents supply pull-ups (no diapers), baby wipes, and plastic bags."
    },
    {
      appliesTo: ["preschool", "kindergarten", "after-school", "saturday-school", "summer-camp"],
      label: "Sibling discount \u2014 10%",
      text: " for all programs, except Summer Camp, which is 5%."
    }
  ]
};
