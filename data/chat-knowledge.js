/* ============================================================
   APLS CHAT ANSWERS
   ------------------------------------------------------------
   Approved answers for the website's rule-based chatbox.
   Tuition responses read from data/tuition.js so prices remain
   in one place.
   ============================================================ */
(function () {
  "use strict";

  var tuition = window.APLS_TUITION || {};
  var tuitionPrograms = tuition.programs || {};

  function formatRows(table) {
    return (table && table.rows || []).map(function (row) {
      return row.join(": ");
    }).join("; ");
  }

  function tuitionAnswer(table, note) {
    var parts = [];
    if (note) parts.push(note);
    var rows = formatRows(table);
    if (rows) parts.push(rows + ".");
    return parts.join(" ");
  }

  var tuitionChoices = [
    { label: "Preschool", target: "tuition-preschool" },
    { label: "Kindergarten & 1st Grade", target: "tuition-kindergarten" },
    { label: "After-School", target: "tuition-after-school" },
    { label: "Saturday School", target: "tuition-saturday" },
    { label: "Summer Camp", target: "tuition-summer" },
    { label: "AP Prep", target: "tuition-ap-prep" }
  ];

  window.APLS_CHAT_KNOWLEDGE = {
    welcome: "Hi! I can help with quick questions about APLS programs, tuition, schedules, and enrollment.",
    suggestions: [
      { label: "Programs", target: "programs" },
      { label: "Tuition", target: "tuition" },
      { label: "Hours", target: "hours" },
      { label: "Enrollment", target: "enrollment" }
    ],
    fallback: {
      answer: "I couldn't find a reliable answer to that question. Please contact APLS and our staff will be happy to help.",
      link: { label: "Contact APLS", href: "contact.html" }
    },
    entries: [
      {
        id: "tuition",
        patterns: ["tuition", "cost", "price", "fees", "how much", "what does it cost"],
        answer: "Tuition varies by program. Which program are you interested in?",
        choices: tuitionChoices,
        pending: "tuition"
      },
      {
        id: "tuition-preschool",
        patterns: ["preschool tuition", "preschool cost", "preschool price", "preschool fees"],
        pendingMatch: ["preschool", "pre school"],
        answer: tuitionAnswer(tuitionPrograms.preschool, tuitionPrograms.preschool && tuitionPrograms.preschool.note),
        link: { label: "View complete tuition details", href: "tuition.html" }
      },
      {
        id: "tuition-kindergarten",
        patterns: ["kindergarten tuition", "kindergarten cost", "first grade tuition", "first grade cost"],
        pendingMatch: ["kindergarten", "first grade", "kindergarten and first grade"],
        answer: tuitionAnswer(tuitionPrograms.kindergarten, tuitionPrograms.kindergarten && tuitionPrograms.kindergarten.note),
        link: { label: "View complete tuition details", href: "tuition.html" }
      },
      {
        id: "tuition-after-school",
        patterns: ["after school tuition", "after school cost", "after school price", "after school fees"],
        pendingMatch: ["after school", "afterschool"],
        answer: tuitionAnswer(tuitionPrograms["after-school"], tuitionPrograms["after-school"] && tuitionPrograms["after-school"].note),
        link: { label: "View complete tuition details", href: "tuition.html" }
      },
      {
        id: "tuition-summer",
        patterns: ["summer camp tuition", "summer camp cost", "summer camp price", "camp tuition"],
        pendingMatch: ["summer camp", "camp"],
        answer: tuitionAnswer(tuitionPrograms["summer-camp"], tuitionPrograms["summer-camp"] && tuitionPrograms["summer-camp"].note),
        link: { label: "View complete tuition details", href: "tuition.html" }
      },
      {
        id: "tuition-saturday",
        patterns: ["saturday school tuition", "saturday school cost", "saturday tuition", "weekend class cost"],
        pendingMatch: ["saturday school", "saturday", "weekend"],
        answer: tuitionAnswer(tuitionPrograms["saturday-school"], tuitionPrograms["saturday-school"] && tuitionPrograms["saturday-school"].note),
        link: { label: "View complete tuition details", href: "tuition.html" }
      },
      {
        id: "tuition-ap-prep",
        patterns: ["ap prep tuition", "ap prep cost", "ap chinese cost", "ap japanese cost"],
        pendingMatch: ["ap prep", "ap chinese", "ap japanese"],
        answer: "Please contact APLS for current AP Prep tuition and class availability.",
        link: { label: "Contact APLS", href: "contact.html" }
      },
      {
        id: "programs",
        patterns: ["programs", "classes", "what do you offer", "which program", "school programs"],
        answer: "APLS offers Preschool, Kindergarten & 1st Grade, After-School, Saturday School, Summer Camp, and AP Prep programs in Chinese and Japanese.",
        link: { label: "Explore all programs", href: "programs.html" }
      },
      {
        id: "languages",
        patterns: ["languages", "what language", "chinese", "japanese", "mandarin"],
        answer: "APLS offers Chinese and Japanese language programs, including immersion programs for young children and classes for older students.",
        link: { label: "Explore all programs", href: "programs.html" }
      },
      {
        id: "beginners",
        patterns: ["beginner", "prior language", "already speak", "need to know chinese", "need to know japanese", "no experience"],
        answer: "No prior Chinese or Japanese knowledge is required. APLS welcomes complete beginners, who build language skills through immersion and instruction."
      },
      {
        id: "ages",
        patterns: ["ages", "age requirement", "how old", "youngest age", "what age", "accept toddlers"],
        answer: "APLS serves children beginning at age 2½ in preschool through high-school age for AP preparation. Eligibility depends on the program.",
        link: { label: "Compare programs", href: "programs.html" }
      },
      {
        id: "hours",
        patterns: ["hours", "open", "close", "operating hours", "school hours", "drop off", "pick up time"],
        answer: "Weekday program hours are Monday through Friday, 8:00 a.m.–5:30 p.m. Extended care is available until 6:00 p.m. Individual program schedules may vary.",
        link: { label: "View program schedules", href: "programs.html" }
      },
      {
        id: "half-day",
        patterns: ["half day", "half-day", "morning program", "custom hours", "choose hours"],
        answer: "When a half-day option is offered, its fixed schedule is 9:00 a.m.–12:00 p.m. Half-day availability varies by program."
      },
      {
        id: "enrollment",
        patterns: ["enroll", "enrollment", "apply", "application", "register", "space available", "start school"],
        answer: "APLS offers year-round rolling enrollment when space is available. Review the enrollment steps or contact the school to find an appropriate program and start date.",
        link: { label: "See enrollment steps", href: "enrollment-process.html" }
      },
      {
        id: "tour",
        patterns: ["tour", "visit", "see the school", "campus visit", "schedule a tour"],
        answer: "You can request a campus tour through our tour page.",
        link: { label: "Schedule a tour", href: "tour.html" }
      },
      {
        id: "lunch",
        patterns: ["lunch", "food", "meals", "bring lunch", "catered lunch"],
        answer: "APLS offers optional catered meals prepared with young children in mind. Families may choose the catered lunch or send lunch from home."
      },
      {
        id: "ratio",
        patterns: ["ratio", "class size", "students per teacher", "teacher student", "how many students"],
        answer: "APLS averages approximately one teacher for every six students. Exact staffing may vary by program, class size, and student needs."
      },
      {
        id: "licensed",
        patterns: ["licensed", "accredited", "license", "accreditation", "private school"],
        answer: "APLS is an accredited private school licensed by the Washington State Office of Superintendent of Public Instruction. Its learning center is also a licensed childcare center."
      },
      {
        id: "location",
        patterns: ["where", "location", "address", "directions", "located"],
        answer: "APLS is located at 14042 NE 8th Street, 1st Floor, Bellevue, WA 98007.",
        link: { label: "View contact information", href: "contact.html" }
      },
      {
        id: "calendar",
        patterns: ["calendar", "school year", "first day", "holiday", "school closed", "important dates"],
        answer: "The 2026–2027 school year begins Wednesday, September 2, 2026. The complete calendar lists holidays, childcare weeks, celebrations, and program dates.",
        link: { label: "View the school calendar", href: "calendar.html" }
      },
      {
        id: "events",
        patterns: ["events", "event", "open house", "announcements", "upcoming event"],
        answer: "The APLS Open House is Saturday, August 22, 2026, from 10:00 a.m. to 1:00 p.m. Tour the school, meet teachers, explore programs, enjoy activities, and enter the raffle.",
        link: { label: "View event details", href: "events.html" }
      },
      {
        id: "contact",
        patterns: ["contact", "phone", "email", "call", "talk to someone", "staff member"],
        answer: "Call APLS at 425-747-4172 or email apls@apls.org.",
        link: { label: "Contact APLS", href: "contact.html" }
      }
    ]
  };
})();