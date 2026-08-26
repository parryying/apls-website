/* ============================================================
   ✏️  DOCUMENTS — PDF handbooks, policies, and extra forms
   ------------------------------------------------------------
   The Forms page reads from here. Program application forms are
   NOT listed here: those live in data/tuition.js as
   applicationUrl, so each program has one source of truth.

   Each document has these fields:
     title   - the link text families see              (required)
     file    - path to the PDF, e.g. "pdfs/Health-Policy.pdf"
                                                       (required)
     program - leave "" to list it under Parent handbook &
               policies, or use a program key (preschool,
               kindergarten, after-school, saturday-school,
               summer-camp, ap-prep) to list it with that
               program's application form
     visible - false hides it from the website
   ============================================================ */
window.APLS_DOCUMENTS = {
  items: [
    {
      title: "2026 camp flyer",
      file: "pdfs/Summer-Camp-Flyer-2026.pdf",
      program: "summer-camp",
      visible: true
    },
    {
      title: "Parent handbook (2025)",
      file: "pdfs/Parent-Handbook-2025.pdf",
      program: "",
      visible: true
    },
    {
      title: "Health policy",
      file: "pdfs/Health-Policy.pdf",
      program: "",
      visible: true
    },
    {
      title: "Emergency plan",
      file: "pdfs/Emergency-Plan.pdf",
      program: "",
      visible: true
    },
    {
      title: "Pesticide policy",
      file: "pdfs/Pesticide-Policy.pdf",
      program: "",
      visible: true
    },
    {
      title: "Reading, writing & communication: birth to 5 (WA)",
      file: "pdfs/WA-Birth-to-5-Curriculum.pdf",
      program: "",
      visible: true
    }
  ]
};
