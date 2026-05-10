# ping_exams — Basic Web Version

**MCQ Exam Preparation Platform**  
Built with pure HTML + CSS + JavaScript. No build tools required.

---

## How to Run

1. **Serve locally** — do NOT open `index.html` directly with `file://` (fetch API won't work).
2. Use any static server:
   ```bash
   # Python
   python3 -m http.server 8080

   # Node (npx)
   npx serve .

   # VS Code Live Server extension
   ```
3. Open `http://localhost:8080` in your browser.

---

## Structure

```
ping_exams_basic/
├── index.html          ← Homepage with subject cards
├── quiz.html           ← Quiz interface (all modes)
├── styles/
│   └── style.css       ← Complete design system
├── scripts/
│   ├── app.js          ← Clock, theme, background, security
│   └── quiz.js         ← Full quiz engine
├── data/               ← 9 subject JSON files
│   ├── FCN_Fundamentals_of_Computer_Networking_MCQ.json
│   ├── COSA_Operating_System_Administration_MCQ.json
│   ├── Compliance_Audit_MCQ.json
│   ├── Cyber_Forensics_MCQ.json
│   ├── NDC_Network_Defense_Countermeasures_MCQ.json
│   ├── IT_Infrastructure_DevOps_MCQ.json
│   ├── Security_Concepts_MCQ.json
│   ├── PKI_Public_Key_Infrastructure_MCQ.json
│   └── Programming_Concepts_MCQ.json
└── assets/             ← Images, icons (add paper-texture.png here)
```

---

## Features

| Feature | Details |
|---|---|
| **Subjects** | 9 subjects, 20 questions each |
| **Modes** | Practice (randomized), Exam (40 Qs, 1-hr timer), Infinity (unlimited) |
| **Answer Persistence** | Answers survive navigation — revisit any question |
| **Refresh Persistence** | sessionStorage restores full state on page reload |
| **Theme** | Light (paper-like) / Dark / System auto-detect |
| **Timer** | Exam timer starts ONLY on explicit click |
| **Difficulty** | Easy / Medium / Hard — badge shown per question |
| **Navigator** | Color-coded dot grid (green=correct, red=wrong, orange=skipped) |
| **Randomization** | Auto-randomized every session (Practice & Exam modes) |
| **Security** | Right-click disabled, F12/DevTools shortcuts blocked |

---

## Adding Questions

Edit any JSON file in `data/`. Format:
```json
{
  "subject": "Subject Name",
  "questions": [
    {
      "id": 21,
      "difficulty": "medium",
      "question": "Your question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 1,
      "explanation": "Why this answer is correct.",
      "takeaway": "One-liner key concept."
    }
  ]
}
```
`correct` is the **0-based index** of the correct option.

---

## Subject → File Mapping

| Subject Key (URL) | JSON File |
|---|---|
| `?subject=FCN` | FCN_Fundamentals_of_Computer_Networking_MCQ.json |
| `?subject=COSA` | COSA_Operating_System_Administration_MCQ.json |
| `?subject=Compliance` | Compliance_Audit_MCQ.json |
| `?subject=CyberForensics` | Cyber_Forensics_MCQ.json |
| `?subject=NDC` | NDC_Network_Defense_Countermeasures_MCQ.json |
| `?subject=DevOps` | IT_Infrastructure_DevOps_MCQ.json |
| `?subject=Security` | Security_Concepts_MCQ.json |
| `?subject=PKI` | PKI_Public_Key_Infrastructure_MCQ.json |
| `?subject=Programming` | Programming_Concepts_MCQ.json |
