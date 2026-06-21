<!-- lmvs/
├── README.md                      # setup + demo walkthrough + API list
├── ARCHITECTURE.md                # diagrams, data model, auth/QR flows
├── .gitignore
│
├── backend/                       # Express + TypeScript API  ← SERVER
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── uploads/                   # local file storage (demo fallback)
│   └── src/
│       ├── server.ts              # ← entry point (boots the server)
│       ├── app.ts                 # Express app + middleware wiring
│       ├── types.ts               # shared domain types
│       ├── config/
│       │   └── index.ts           # env config + feature flags
│       ├── models/
│       │   └── index.ts           # Mongoose SCHEMAS (5 collections)
│       ├── repositories/
│       │   ├── store.ts           # in-memory store (demo)
│       │   └── index.ts           # repository facade
│       ├── middleware/
│       │   ├── auth.ts            # JWT + RBAC (authenticate/authorize)
│       │   └── error.ts           # async wrapper + error handler
│       ├── services/
│       │   ├── ocr.service.ts            # mock OCR
│       │   ├── external.service.ts       # mock NIDW/DIP gov API
│       │   ├── verification.service.ts   # comparison + scoring
│       │   ├── storage.service.ts        # Cloudinary / local
│       │   └── qr.service.ts             # QR + serial generation
│       ├── controllers/           # auth, document, verification, qr, admin
│       ├── routes/
│       │   └── index.ts           # all endpoints wired here
│       └── seed/
│           └── seed.ts            # demo accounts
│
└── frontend/                      # React + TS + Tailwind (Vite)
    ├── .env.example
    ├── package.json
    ├── vite.config.ts / tsconfig.json / tailwind.config.js / postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx               # entry
        ├── App.tsx                # router + role-based routing
        ├── index.css
        ├── api/index.ts           # axios client + endpoint wrappers
        ├── context/AuthContext.tsx
        ├── components/ui.tsx      # Navbar, Card, StatusBadge, TrustMeter
        └── pages/
            ├── Login.tsx
            ├── Register.tsx
            ├── WorkerDashboard.tsx   # upload → verify → QR
            ├── AdminDashboard.tsx    # stats, review, approve/reject
            └── VerifyPortal.tsx      # public QR target -->